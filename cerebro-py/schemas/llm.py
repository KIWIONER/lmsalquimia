from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field

FeatureType = Literal["tutor_chat", "quiz_gen", "itinerary", "card_structure"]


class StructuredCardOutput(BaseModel):
    """Contrato estricto para tarjeta pedagógica estructurada/traducida por LLM."""

    model_config = ConfigDict(extra="forbid")

    titulo: str = Field(..., min_length=2, max_length=120)
    contenido_markdown: str = Field(..., min_length=10)


class LLMRouterRequest(BaseModel):
    """Solicitud estructurada al enrutador multi-LLM con contexto y trazabilidad."""

    model_config = ConfigDict(extra="forbid")

    prompt: str = Field(..., min_length=1, max_length=16000)
    system_prompt: str = Field(default="")
    source_context: str = Field(default="")
    feature: FeatureType = "tutor_chat"
    user_id: str = Field(default="anonymous")
    session_id: str = Field(default="default")
    prompt_version: str = Field(default="v2.0")
    temperature: float = Field(default=0.2, ge=0.0, le=1.0)
    max_tokens: int = Field(default=1024, ge=64, le=8192)


class LLMRouterResponse(BaseModel):
    """Respuesta validada del enrutador multi-LLM con métricas de observabilidad."""

    model_config = ConfigDict(extra="forbid")

    content: str
    parsed_json: Optional[Dict[str, Any]] = None
    provider: str
    model: str
    fallback_used: bool = False
    repair_retried: bool = False
    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: float = 0.0
    cost_usd: float = 0.0
    prompt_version: str = "v2.0"
    schema_valid: bool = True
    guardrail_passed: bool = True
    guardrail_errors: List[str] = Field(default_factory=list)
    cache_hit: bool = False
