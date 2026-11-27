import base64
import logging
import os
import time
import uuid
from typing import Any, Dict, List, Optional
import httpx

logger = logging.getLogger("alquimia_observability")

# Tarifas aproximadas USD por 1M tokens para estimación FinOps
MODEL_RATES_PER_1M: Dict[str, tuple[float, float]] = {
    "gemini-2.5-flash": (0.15, 0.60),
    "gpt-4o-mini": (0.15, 0.60),
    "local-fallback": (0.0, 0.0),
}


def estimate_cost_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    in_rate, out_rate = MODEL_RATES_PER_1M.get(model, (0.20, 0.80))
    return round((input_tokens * in_rate + output_tokens * out_rate) / 1_000_000, 6)


class LangfuseObserver:
    """
    Registrador de trazas LLM compatible con Langfuse Ingestion API.
    Si no hay claves configuradas, almacena trazas en un buffer en memoria para auditoría y tests.
    """

    def __init__(
        self,
        public_key: Optional[str] = None,
        secret_key: Optional[str] = None,
        host: Optional[str] = None,
    ) -> None:
        self.public_key = public_key or os.getenv("LANGFUSE_PUBLIC_KEY", "")
        self.secret_key = secret_key or os.getenv("LANGFUSE_SECRET_KEY", "")
        self.host = (host or os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com")).rstrip("/")
        self.traces: List[Dict[str, Any]] = []

    def is_remote_enabled(self) -> bool:
        return bool(self.public_key and self.secret_key)

    def record_trace(self, trace: Dict[str, Any]) -> str:
        trace_id = trace.get("trace_id") or str(uuid.uuid4())
        enriched = {
            "trace_id": trace_id,
            "timestamp": time.time(),
            **trace,
        }
        self.traces.append(enriched)
        if len(self.traces) > 500:
            self.traces = self.traces[-500:]

        if self.is_remote_enabled():
            self._send_to_langfuse(enriched)
        return trace_id

    def _send_to_langfuse(self, trace: Dict[str, Any]) -> None:
        token = base64.b64encode(f"{self.public_key}:{self.secret_key}".encode()).decode()
        batch_payload = {
            "batch": [
                {
                    "id": str(uuid.uuid4()),
                    "type": "trace-create",
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "body": {
                        "id": trace["trace_id"],
                        "name": trace.get("feature", "tutor_chat"),
                        "userId": trace.get("user_id", "anonymous"),
                        "sessionId": trace.get("session_id", "default"),
                        "metadata": {
                            "prompt_version": trace.get("prompt_version"),
                            "provider": trace.get("provider"),
                            "model": trace.get("model"),
                            "fallback_used": trace.get("fallback_used"),
                            "cache_hit": trace.get("cache_hit"),
                            "latency_ms": trace.get("latency_ms"),
                            "input_tokens": trace.get("input_tokens"),
                            "output_tokens": trace.get("output_tokens"),
                            "cost_usd": trace.get("cost_usd"),
                            "schema_valid": trace.get("schema_valid"),
                            "guardrail_passed": trace.get("guardrail_passed"),
                            "retrieval_recall": trace.get("retrieval_recall"),
                        },
                    },
                }
            ]
        }
        try:
            with httpx.Client(timeout=3.0) as client:
                client.post(
                    f"{self.host}/api/public/ingestion",
                    headers={
                        "Authorization": f"Basic {token}",
                        "Content-Type": "application/json",
                    },
                    json=batch_payload,
                )
        except Exception as exc:
            logger.warning("No se pudo enviar traza a Langfuse: %s", exc)


default_observer = LangfuseObserver()
