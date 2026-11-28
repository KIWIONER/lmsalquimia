"""
Evals semánticos sobre el RAG de Alquimia LMS:
Mide Context Recall, Faithfulness y Numerical Grounding sobre casos clínicos reales (UD4-UD6).

Uso:
  PYTHONPATH=cerebro-py python -m evals.rag_evals --mode deterministic
  PYTHONPATH=cerebro-py python -m evals.rag_evals --mode llm_judge
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional

import httpx
from pydantic import BaseModel, Field

from config import LOCAL_LLM_MODEL, LOCAL_LLM_URL
from services.guardrails import validate_numerical_integrity

EVALS_DIR = Path(__file__).resolve().parent
DEFAULT_RAG_DATASET = EVALS_DIR / "rag_golden_dataset.json"
DEFAULT_RAG_REPORT = EVALS_DIR / "last_rag_report.json"

STOPWORDS_ES = {
    "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "al",
    "en", "con", "por", "para", "que", "se", "su", "sus", "es", "son", "como",
    "y", "o", "a", "si", "no", "mas", "más", "entre", "tras", "cuando", "segun",
    "según", "este", "esta", "estos", "estas", "mediante", "durante", "sobre",
}


class RagEvalCase(BaseModel):
    case_id: str
    unit: str
    query: str
    retrieved_contexts: List[str]
    expected_facts: List[str]
    candidate_answer: str
    expected_faithful: bool = True


class RagEvalItem(BaseModel):
    case_id: str
    unit: str
    context_recall: float = Field(ge=0.0, le=1.0)
    faithfulness: float = Field(ge=0.0, le=1.0)
    numerical_grounding: float = Field(ge=0.0, le=1.0)
    expected_faithful: bool
    passed: bool
    reason: str


class RagEvalSummary(BaseModel):
    mode: Literal["deterministic", "llm_judge"]
    total_cases: int
    positive_cases: int
    adversarial_cases: int
    passed_cases: int
    avg_context_recall: float
    avg_faithfulness: float
    avg_numerical_grounding: float
    adversarial_catch_rate: float
    thresholds_met: bool
    items: List[RagEvalItem]


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower()).strip()


def _content_tokens(text: str) -> List[str]:
    tokens = re.findall(r"[a-z0-9áéíóúñü%°.,-]+", text.lower())
    return [t for t in tokens if len(t) > 2 and t not in STOPWORDS_ES]


def compute_context_recall(expected_facts: List[str], retrieved_contexts: List[str]) -> float:
    if not expected_facts:
        return 1.0
    joined_ctx = _normalize_text(" ".join(retrieved_contexts))
    hits = sum(1 for fact in expected_facts if _normalize_text(fact) in joined_ctx)
    return round(hits / len(expected_facts), 4)


def compute_deterministic_faithfulness(candidate_answer: str, retrieved_contexts: List[str], num_ok: bool) -> float:
    if not num_ok:
        return 0.0
    ctx_tokens = set(_content_tokens(" ".join(retrieved_contexts)))
    ans_tokens = _content_tokens(candidate_answer)
    if not ans_tokens:
        return 0.0
    grounded = sum(1 for tok in ans_tokens if tok in ctx_tokens)
    return round(grounded / len(ans_tokens), 4)


def judge_faithfulness_with_local_llm(
    query: str,
    retrieved_contexts: List[str],
    candidate_answer: str,
    model: str = LOCAL_LLM_MODEL,
    base_url: str = LOCAL_LLM_URL,
) -> float:
    """Evalúa Faithfulness semántica usando el LLM local GPU con temperature=0 y salida JSON."""
    endpoint = base_url.rstrip("/")
    if not endpoint.endswith("/api/chat"):
        endpoint = f"{endpoint}/api/chat"

    prompt = (
        "Evalúa la fidelidad (faithfulness) de la RESPUESTA respecto al CONTEXTO RECUPERADO.\n"
        "Responde SOLO con JSON válido: {\"faithfulness\": <float entre 0.0 y 1.0>, \"reason\": \"...\"}.\n"
        "Penaliza a 0.0 si la respuesta inventa cifras, dosis, temperaturas o hechos no presentes en el contexto.\n\n"
        f"PREGUNTA: {query}\n"
        f"CONTEXTO RECUPERADO:\n- " + "\n- ".join(retrieved_contexts) + "\n\n"
        f"RESPUESTA CANDIDATA:\n{candidate_answer}"
    )

    payload = {
        "model": model,
        "stream": False,
        "format": "json",
        "options": {"temperature": 0, "num_ctx": 4096},
        "messages": [
            {"role": "system", "content": "Eres un auditor estricto de RAG clínico. Responde solo JSON."},
            {"role": "user", "content": prompt},
        ],
    }

    with httpx.Client(timeout=45.0) as client:
        res = client.post(endpoint, json=payload)
        res.raise_for_status()
        data = res.json()

    raw_content = data.get("message", {}).get("content", "{}")
    parsed = json.loads(raw_content)
    score = float(parsed.get("faithfulness", 0.0))
    return round(max(0.0, min(1.0, score)), 4)


def evaluate_rag_case(
    case: RagEvalCase,
    mode: Literal["deterministic", "llm_judge"] = "deterministic",
) -> RagEvalItem:
    joined_ctx = "\n".join(case.retrieved_contexts)
    context_recall = compute_context_recall(case.expected_facts, case.retrieved_contexts)
    num_ok, num_errors = validate_numerical_integrity(joined_ctx, case.candidate_answer)
    numerical_grounding = 1.0 if num_ok else 0.0

    if mode == "llm_judge":
        try:
            llm_faithfulness = judge_faithfulness_with_local_llm(
                case.query, case.retrieved_contexts, case.candidate_answer
            )
            # Guardrail duro: si falla integridad numérica, faithfulness cae a 0.0
            faithfulness = llm_faithfulness if num_ok else 0.0
        except Exception:
            faithfulness = compute_deterministic_faithfulness(
                case.candidate_answer, case.retrieved_contexts, num_ok
            )
    else:
        faithfulness = compute_deterministic_faithfulness(
            case.candidate_answer, case.retrieved_contexts, num_ok
        )

    if case.expected_faithful:
        passed = context_recall >= 0.80 and faithfulness >= 0.50 and numerical_grounding == 1.0
        reason = "OK" if passed else f"recall={context_recall}, faith={faithfulness}, num_errors={num_errors}"
    else:
        # Caso adversario: debe ser detectado (faithfulness baja o fallo numérico)
        caught = (numerical_grounding == 0.0) or (faithfulness < 0.50)
        passed = caught
        reason = (
            "Alucinación detectada y bloqueada"
            if caught
            else "Fallo: el evaluador no detectó la respuesta infiel"
        )

    return RagEvalItem(
        case_id=case.case_id,
        unit=case.unit,
        context_recall=context_recall,
        faithfulness=faithfulness,
        numerical_grounding=numerical_grounding,
        expected_faithful=case.expected_faithful,
        passed=passed,
        reason=reason,
    )


def run_rag_eval_suite(
    dataset_path: Path = DEFAULT_RAG_DATASET,
    report_path: Optional[Path] = DEFAULT_RAG_REPORT,
    mode: Literal["deterministic", "llm_judge"] = "deterministic",
) -> RagEvalSummary:
    raw_cases = json.loads(dataset_path.read_text(encoding="utf-8"))
    cases = [RagEvalCase.model_validate(item) for item in raw_cases]
    items = [evaluate_rag_case(c, mode=mode) for c in cases]

    pos_items = [i for i in items if i.expected_faithful]
    adv_items = [i for i in items if not i.expected_faithful]

    avg_recall = round(sum(i.context_recall for i in pos_items) / len(pos_items), 4) if pos_items else 1.0
    avg_faith = round(sum(i.faithfulness for i in pos_items) / len(pos_items), 4) if pos_items else 1.0
    avg_num = round(sum(i.numerical_grounding for i in pos_items) / len(pos_items), 4) if pos_items else 1.0
    adv_catch = round(sum(1 for i in adv_items if i.passed) / len(adv_items), 4) if adv_items else 1.0

    min_faith_threshold = 0.85 if mode == "llm_judge" else 0.55
    thresholds_met = (
        avg_recall >= 0.85
        and avg_faith >= min_faith_threshold
        and avg_num == 1.0
        and adv_catch == 1.0
        and all(i.passed for i in items)
    )

    summary = RagEvalSummary(
        mode=mode,
        total_cases=len(items),
        positive_cases=len(pos_items),
        adversarial_cases=len(adv_items),
        passed_cases=sum(1 for i in items if i.passed),
        avg_context_recall=avg_recall,
        avg_faithfulness=avg_faith,
        avg_numerical_grounding=avg_num,
        adversarial_catch_rate=adv_catch,
        thresholds_met=thresholds_met,
        items=items,
    )

    if report_path is not None:
        report_path.write_text(summary.model_dump_json(indent=2), encoding="utf-8")

    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description="Evals semánticos sobre RAG de Alquimia LMS")
    parser.add_argument("--mode", choices=["deterministic", "llm_judge"], default="deterministic")
    args = parser.parse_args()

    summary = run_rag_eval_suite(mode=args.mode)
    print(
        f"[RAG EVALS] mode={summary.mode} | passed={summary.passed_cases}/{summary.total_cases} "
        f"| context_recall={summary.avg_context_recall:.2f} | faithfulness={summary.avg_faithfulness:.2f} "
        f"| numerical_grounding={summary.avg_numerical_grounding:.2f} | adv_catch={summary.adversarial_catch_rate:.2f}"
    )
    return 0 if summary.thresholds_met else 1


if __name__ == "__main__":
    sys.exit(main())
