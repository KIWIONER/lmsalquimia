from pydantic import BaseModel, Field
from typing import List, Optional

class QuizQuestion(BaseModel):
    id: str = Field(..., description="Identificador único de la pregunta")
    text: str = Field(..., min_length=15, description="Enunciado clínico/académico de la pregunta")
    options: List[str] = Field(..., min_length=4, max_length=4, description="Exactamente 4 alternativas de respuesta")
    correctAnswer: int = Field(..., ge=0, le=3, description="Índice de la respuesta correcta (0 a 3)")
    rationale: str = Field(..., description="Justificación clínica y evidencia científica de la respuesta correcta")
    hint: str = Field(..., description="Pista orientativa para el modo de estudio/práctica")

class QuizGenerationRequest(BaseModel):
    topics: List[str] = Field(default_factory=list, description="Lista de slugs o nombres de unidades temáticas seleccionadas")
    difficulty: int = Field(default=5, ge=1, le=10, description="Nivel de dificultad (1 a 10)")
    numQuestions: int = Field(default=10, ge=1, le=25, description="Número de preguntas a generar")
    mode: str = Field(default="practice", description="Modo: 'practice' o 'exam'")
    sessionId: Optional[str] = None

class QuizGenerationResponse(BaseModel):
    success: bool
    count: int
    questions: List[QuizQuestion]
    source: str = Field(default="cerebro_py_engine")
    error: Optional[str] = None
