from unittest.mock import MagicMock, patch

from evals.rag_evals import (
    RagEvalCase,
    evaluate_rag_case,
    run_rag_eval_suite,
)


def test_rag_evals_deterministic_suite_passes(tmp_path):
    report_path = tmp_path / "rag_report.json"
    summary = run_rag_eval_suite(report_path=report_path, mode="deterministic")

    assert summary.total_cases == 10
    assert summary.positive_cases == 8
    assert summary.adversarial_cases == 2
    assert summary.passed_cases == 10
    assert summary.avg_context_recall >= 0.85
    assert summary.avg_numerical_grounding == 1.0
    assert summary.adversarial_catch_rate == 1.0
    assert summary.thresholds_met is True
    assert report_path.exists()


def test_rag_evals_blocks_invented_clinical_number():
    case = RagEvalCase(
        case_id="test-num-block",
        unit="UD4",
        query="¿Temperatura HTST leche?",
        retrieved_contexts=["Para la leche: 72 °C durante 15 segundos."],
        expected_facts=["72 °C", "15 segundos"],
        candidate_answer="Para la leche se aplican 99 °C durante 15 segundos.",
        expected_faithful=True,
    )
    result = evaluate_rag_case(case, mode="deterministic")
    assert result.numerical_grounding == 0.0
    assert result.faithfulness == 0.0
    assert result.passed is False


def test_rag_evals_llm_judge_validates_temperature_zero_and_hard_guardrail():
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {
        "message": {"content": '{"faithfulness": 0.95, "reason": "Fiel al contexto"}'}
    }

    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.__exit__.return_value = False
    mock_client.post.return_value = mock_response

    with patch("evals.rag_evals.httpx.Client", return_value=mock_client):
        case_ok = RagEvalCase(
            case_id="llm-ok",
            unit="UD6",
            query="¿Grasa leche entera?",
            retrieved_contexts=["Leche entera: 3,7% grasa."],
            expected_facts=["3,7%"],
            candidate_answer="La leche entera tiene 3,7% de grasa.",
            expected_faithful=True,
        )
        res_ok = evaluate_rag_case(case_ok, mode="llm_judge")
        assert res_ok.passed is True
        assert res_ok.faithfulness == 0.95

        # Verificar call_args: temperature=0 y format=json
        _, kwargs = mock_client.post.call_args
        assert kwargs["json"]["options"]["temperature"] == 0
        assert kwargs["json"]["format"] == "json"

        # Aunque el juez LLM dé 0.95, si hay alucinación numérica el guardrail fuerza 0.0
        case_hallucinated = RagEvalCase(
            case_id="llm-num-fail",
            unit="UD6",
            query="¿Grasa leche entera?",
            retrieved_contexts=["Leche entera: 3,7% grasa."],
            expected_facts=["3,7%"],
            candidate_answer="La leche entera tiene 15% de grasa.",
            expected_faithful=True,
        )
        res_bad = evaluate_rag_case(case_hallucinated, mode="llm_judge")
        assert res_bad.numerical_grounding == 0.0
        assert res_bad.faithfulness == 0.0
        assert res_bad.passed is False
