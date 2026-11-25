from typing import Any, Dict, Literal
from pydantic import BaseModel, ConfigDict, Field

JobType = Literal["pdf_structure", "generate_quiz_long", "progress_report"]


class AsyncJobMessage(BaseModel):
    """Contrato estricto de mensaje SQS para trabajos asíncronos de Alquimia LMS."""

    model_config = ConfigDict(extra="forbid")

    job_id: str = Field(..., min_length=1)
    user_id: str = Field(..., min_length=1)
    job_type: JobType
    payload: Dict[str, Any] = Field(default_factory=dict)
    correlation_id: str = Field(..., min_length=1)
    created_at: str = Field(..., min_length=1)
