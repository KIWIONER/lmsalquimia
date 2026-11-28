import asyncio
import json
import logging
import os
from typing import Any, Dict, List, Optional

from schemas.async_job import AsyncJobMessage
from schemas.quiz import QuizGenerationRequest
from services.health_pdf_pipeline import process_pdf_with_4_layers
from services.job_repository import JobRepository, SupabaseJobRepository
from services.quiz_service import generate_adaptive_quiz

logger = logging.getLogger("alquimia_lambda_worker")
logger.setLevel(logging.INFO)


def _get_s3_client():
    import boto3

    return boto3.client("s3")


def _process_pdf_job(
    msg: AsyncJobMessage,
    s3_client: Any,
    bucket: str,
) -> Dict[str, Any]:
    s3_key = msg.payload.get("s3Key")
    if not s3_key or not isinstance(s3_key, str):
        raise ValueError("Payload de pdf_structure requiere s3Key válido.")

    obj = s3_client.get_object(Bucket=bucket, Key=s3_key)
    pdf_bytes = obj["Body"].read()
    pipeline_outcome = asyncio.run(process_pdf_with_4_layers(pdf_bytes, mode="prod_api"))
    cards = pipeline_outcome.get("cards", [])
    report = pipeline_outcome.get("report", {})

    result_key = f"generated/reports/{msg.user_id}/{msg.job_id}.json"
    result_body = json.dumps(
        {
            "job_id": msg.job_id,
            "total_cards": len(cards),
            "cards": cards,
            "verification_report": report,
        },
        ensure_ascii=False,
    ).encode("utf-8")

    s3_client.put_object(
        Bucket=bucket,
        Key=result_key,
        Body=result_body,
        ContentType="application/json",
    )

    return {
        "result_url": result_key,
        "result_payload": {
            "total_cards": len(cards),
            "s3_result_key": result_key,
            "verification_report": report,
        },
    }


def _process_quiz_job(msg: AsyncJobMessage) -> Dict[str, Any]:
    req = QuizGenerationRequest(
        topics=msg.payload.get("topics", []),
        difficulty=int(msg.payload.get("difficulty", 5)),
        numQuestions=int(msg.payload.get("numQuestions", 10)),
        mode=msg.payload.get("mode", "practice"),
        sessionId=msg.job_id,
    )
    quiz_res = asyncio.run(generate_adaptive_quiz(req))
    return {
        "result_url": None,
        "result_payload": quiz_res.model_dump(),
    }


def _process_report_job(msg: AsyncJobMessage) -> Dict[str, Any]:
    period_days = int(msg.payload.get("periodDays", 30))
    return {
        "result_url": None,
        "result_payload": {
            "user_id": msg.user_id,
            "period_days": period_days,
            "status": "generated",
        },
    }


def process_record(
    record: Dict[str, Any],
    repo: JobRepository,
    s3_client: Any,
    bucket: str,
) -> None:
    msg = AsyncJobMessage.model_validate_json(record["body"])

    # Idempotencia por job_id: si ya fue completado, no duplicar trabajo
    existing = repo.get_job(msg.job_id)
    if existing and existing.get("status") == "completed":
        logger.info("Job %s ya completado previamente (no-op idempotente).", msg.job_id)
        return

    attempts = int((existing or {}).get("attempts", 0)) + 1
    # Persistencia incremental inmediata ANTES de la operación pesada
    repo.mark_processing(msg.job_id, attempts=attempts)

    if msg.job_type == "pdf_structure":
        outcome = _process_pdf_job(msg, s3_client=s3_client, bucket=bucket)
    elif msg.job_type == "generate_quiz_long":
        outcome = _process_quiz_job(msg)
    elif msg.job_type == "progress_report":
        outcome = _process_report_job(msg)
    else:
        raise ValueError(f"job_type no soportado: {msg.job_type}")

    repo.mark_completed(
        msg.job_id,
        result_url=outcome.get("result_url"),
        result_payload=outcome.get("result_payload"),
    )


def handler(
    event: Dict[str, Any],
    _context: Any,
    repo: Optional[JobRepository] = None,
    s3_client: Any = None,
) -> Dict[str, List[Dict[str, str]]]:
    """Handler AWS Lambda para eventos SQS con ReportBatchItemFailures."""
    active_repo = repo or SupabaseJobRepository()
    active_s3 = s3_client or _get_s3_client()
    bucket = os.getenv("S3_BUCKET", "")

    batch_item_failures: List[Dict[str, str]] = []

    for record in event.get("Records", []):
        message_id = record.get("messageId", "unknown")
        parsed_job_id: Optional[str] = None
        try:
            raw_body = json.loads(record.get("body", "{}"))
            if isinstance(raw_body, dict):
                parsed_job_id = raw_body.get("job_id")
        except Exception:
            pass

        try:
            process_record(record, repo=active_repo, s3_client=active_s3, bucket=bucket)
        except Exception as exc:
            logger.exception("Error procesando mensaje SQS %s: %s", message_id, exc)
            if parsed_job_id:
                try:
                    active_repo.mark_failed(parsed_job_id, str(exc))
                except Exception:
                    logger.warning("No se pudo marcar failed en BD para %s", parsed_job_id)
            batch_item_failures.append({"itemIdentifier": message_id})

    return {"batchItemFailures": batch_item_failures}
