import json
import time
from typing import Any, Awaitable, Callable, Dict, Optional, Type
import httpx
from pydantic import BaseModel, ValidationError

from config import GEMINI_API_KEY, GEMINI_MODEL, OPENAI_API_KEY, OPENAI_FALLBACK_MODEL
from schemas.llm import LLMRouterRequest, LLMRouterResponse
from services.guardrails import detect_prompt_injection, validate_numerical_integrity
from services.observability import LangfuseObserver, default_observer, estimate_cost_usd

ProviderCaller = Callable[[str, str, LLMRouterRequest], Awaitable[Dict[str, Any]]]


async def _default_provider_caller(
    provider: str,
    model: str,
    req: LLMRouterRequest,
) -> Dict[str, Any]:
    """Llamada HTTP directa a Gemini (primario) u OpenAI (fallback) sin dependencias pesadas."""
    if provider == "gemini":
        if not GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY no configurada")
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{model}:generateContent?key={GEMINI_API_KEY}"
        )
        body: Dict[str, Any] = {
            "contents": [{"role": "user", "parts": [{"text": req.prompt}]}],
            "generationConfig": {
                "temperature": req.temperature,
                "maxOutputTokens": req.max_tokens,
            },
        }
        if req.system_prompt:
            body["systemInstruction"] = {"parts": [{"text": req.system_prompt}]}

        async with httpx.AsyncClient(timeout=12.0) as client:
            res = await client.post(url, json=body)
            if res.status_code >= 400:
                raise RuntimeError(f"Gemini HTTP {res.status_code}: {res.text[:200]}")
            data = res.json()
            text = (
                data.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "")
            )
            usage = data.get("usageMetadata", {})
            return {
                "text": text,
                "input_tokens": int(usage.get("promptTokenCount", max(1, len(req.prompt) // 4))),
                "output_tokens": int(usage.get("candidatesTokenCount", max(1, len(text) // 4))),
            }

    if provider == "openai":
        if not OPENAI_API_KEY:
            raise RuntimeError("OPENAI_API_KEY no configurada")
        messages = []
        if req.system_prompt:
            messages.append({"role": "system", "content": req.system_prompt})
        messages.append({"role": "user", "content": req.prompt})

        async with httpx.AsyncClient(timeout=12.0) as client:
            res = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": messages,
                    "temperature": req.temperature,
                    "max_tokens": req.max_tokens,
                },
            )
            if res.status_code >= 400:
                raise RuntimeError(f"OpenAI HTTP {res.status_code}: {res.text[:200]}")
            data = res.json()
            text = data["choices"][0]["message"]["content"]
            usage = data.get("usage", {})
            return {
                "text": text,
                "input_tokens": int(usage.get("prompt_tokens", max(1, len(req.prompt) // 4))),
                "output_tokens": int(usage.get("completion_tokens", max(1, len(text) // 4))),
            }

    raise RuntimeError(f"Proveedor no soportado: {provider}")


class LLMRouter:
    """Enrutador multi-LLM con fallback automático, reparación de esquema, guardrails y Langfuse."""

    def __init__(
        self,
        primary_provider: str = "gemini",
        primary_model: str = GEMINI_MODEL,
        fallback_provider: str = "openai",
        fallback_model: str = OPENAI_FALLBACK_MODEL,
        observer: Optional[LangfuseObserver] = None,
        provider_caller: Optional[ProviderCaller] = None,
    ) -> None:
        self.primary_provider = primary_provider
        self.primary_model = primary_model
        self.fallback_provider = fallback_provider
        self.fallback_model = fallback_model
        self.observer = observer or default_observer
        self.provider_caller = provider_caller or _default_provider_caller

    async def generate(
        self,
        req: LLMRouterRequest,
        response_schema: Optional[Type[BaseModel]] = None,
        retrieval_recall: Optional[float] = None,
    ) -> LLMRouterResponse:
        t0 = time.perf_counter()

        # Bloqueo preventivo ante prompt injection explícito
        if detect_prompt_injection(req.prompt):
            latency_ms = round((time.perf_counter() - t0) * 1000, 2)
            resp = LLMRouterResponse(
                content=(
                    "No puedo procesar instrucciones que intenten alterar las reglas académicas "
                    "del Profesor Alquimia. Formula tu consulta científica directamente."
                ),
                provider="guardrail",
                model="policy-block",
                latency_ms=latency_ms,
                prompt_version=req.prompt_version,
                schema_valid=True,
                guardrail_passed=False,
                guardrail_errors=["Prompt injection detectado en entrada."],
            )
            self._emit_trace(req, resp, retrieval_recall)
            return resp

        provider_used = self.primary_provider
        model_used = self.primary_model
        fallback_used = False
        repair_retried = False

        raw_result: Optional[Dict[str, Any]] = None
        try:
            raw_result = await self.provider_caller(self.primary_provider, self.primary_model, req)
        except Exception:
            fallback_used = True
            provider_used = self.fallback_provider
            model_used = self.fallback_model
            raw_result = await self.provider_caller(self.fallback_provider, self.fallback_model, req)

        text = str(raw_result.get("text", "")).strip()
        in_tokens = int(raw_result.get("input_tokens", 0))
        out_tokens = int(raw_result.get("output_tokens", 0))

        parsed_json: Optional[Dict[str, Any]] = None
        schema_valid = True

        if response_schema is not None:
            parsed_json, schema_valid = self._validate_schema(text, response_schema)
            if not schema_valid:
                repair_retried = True
                repair_req = req.model_copy(
                    update={
                        "prompt": (
                            f"{req.prompt}\n\nIMPORTANTE: Devuelve exclusivamente JSON válido "
                            f"ajustado al esquema requerido, sin texto ni markdown adicional."
                        )
                    }
                )
                repaired = await self.provider_caller(provider_used, model_used, repair_req)
                text = str(repaired.get("text", "")).strip()
                in_tokens += int(repaired.get("input_tokens", 0))
                out_tokens += int(repaired.get("output_tokens", 0))
                parsed_json, schema_valid = self._validate_schema(text, response_schema)

        guardrail_passed = True
        guardrail_errors: list[str] = []
        if req.source_context.strip():
            guardrail_passed, guardrail_errors = validate_numerical_integrity(
                req.source_context, text
            )
            if not guardrail_passed:
                text = (
                    "⚠️ La respuesta generada contenía cifras o dosis no verificables en la "
                    "bibliografía de referencia y ha sido bloqueada por seguridad científica."
                )

        latency_ms = round((time.perf_counter() - t0) * 1000, 2)
        cost_usd = estimate_cost_usd(model_used, in_tokens, out_tokens)

        resp = LLMRouterResponse(
            content=text,
            parsed_json=parsed_json,
            provider=provider_used,
            model=model_used,
            fallback_used=fallback_used,
            repair_retried=repair_retried,
            input_tokens=in_tokens,
            output_tokens=out_tokens,
            latency_ms=latency_ms,
            cost_usd=cost_usd,
            prompt_version=req.prompt_version,
            schema_valid=schema_valid,
            guardrail_passed=guardrail_passed,
            guardrail_errors=guardrail_errors,
        )
        self._emit_trace(req, resp, retrieval_recall)
        return resp

    def _validate_schema(
        self, raw_text: str, schema: Type[BaseModel]
    ) -> tuple[Optional[Dict[str, Any]], bool]:
        cleaned = raw_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            if cleaned.startswith("json"):
                cleaned = cleaned[4:].strip()
        try:
            obj = json.loads(cleaned)
            validated = schema.model_validate(obj)
            return validated.model_dump(), True
        except (json.JSONDecodeError, ValidationError):
            return None, False

    def _emit_trace(
        self,
        req: LLMRouterRequest,
        resp: LLMRouterResponse,
        retrieval_recall: Optional[float],
    ) -> None:
        self.observer.record_trace(
            {
                "user_id": req.user_id,
                "session_id": req.session_id,
                "feature": req.feature,
                "prompt_version": resp.prompt_version,
                "provider": resp.provider,
                "model": resp.model,
                "fallback_used": resp.fallback_used,
                "cache_hit": resp.cache_hit,
                "latency_ms": resp.latency_ms,
                "input_tokens": resp.input_tokens,
                "output_tokens": resp.output_tokens,
                "cost_usd": resp.cost_usd,
                "schema_valid": resp.schema_valid,
                "guardrail_passed": resp.guardrail_passed,
                "retrieval_recall": retrieval_recall,
            }
        )
