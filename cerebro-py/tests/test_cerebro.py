import pytest
import asyncio
from fastapi.testclient import TestClient
from main import app
from schemas.quiz import QuizQuestion, QuizGenerationRequest
from services.quiz_service import generate_adaptive_quiz

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "quiz_generator" in data["modules"]

def test_quiz_schema_validation():
    # Valid question
    q = QuizQuestion(
        id="q1",
        text="¿Cuál es el valor del gasto basal?",
        options=["Opción A", "Opción B", "Opción C", "Opción D"],
        correctAnswer=1,
        rationale="Explicación clínica detallada.",
        hint="Pista de estudio."
    )
    assert q.correctAnswer == 1
    assert len(q.options) == 4

@pytest.mark.asyncio
async def test_quiz_generation_service():
    req = QuizGenerationRequest(
        topics=["alimentacion-equilibrada"],
        difficulty=6,
        numQuestions=5,
        mode="practice"
    )
    res = await generate_adaptive_quiz(req)
    assert res.success is True
    assert len(res.questions) == 5
    for q in res.questions:
        assert len(q.options) == 4
        assert 0 <= q.correctAnswer <= 3
        assert len(q.rationale) > 10
        assert not q.id.startswith("fb-")  # Garantizar que NO es el mock estático
