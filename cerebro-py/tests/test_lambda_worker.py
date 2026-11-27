import io
import json
import threading
import time
from typing import Any, Dict, List, Optional

import pymupdf
import pytest
from pydantic import ValidationError

import lambda_handler
from schemas.async_job import AsyncJobMessage


class InMemoryJobRepository:
    """Repositorio en memoria thread-safe para verificar transiciones incrementales."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.jobs: Dict[str, Dict[str, Any]] = {}
        self.history: List[str] = []

    def seed(self, job_id: str, status: str = "pending", attempts: int = 0) -> None:
        with self._lock:
            self.jobs[job_id] = {
                "id": job_id,
                "status": status,
                "attempts": attempts,
                "result_url": None,
                "result_payload": None,
                "error_message": None,
            }

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            job = self.jobs.get(job_id)
            return dict(job) if job else None

    def mark_processing(self, job_id: str, attempts: int) -> None:
        with self._lock:
            job = self.jobs.setdefault(job_id, {"id": job_id})
            job["status"] = "processing"
            job["attempts"] = attempts
            self.history.append(f"{job_id}:processing")

    def mark_completed(
        self,
        job_id: str,
        result_url: Optional[str] = None,
        result_payload: Optional[Dict[str, Any]] = None,
    ) -> None:
        with self._lock:
            job = self.jobs.setdefault(job_id, {"id": job_id})
            job["status"] = "completed"
            job["result_url"] = result_url
            job["result_payload"] = result_payload
            job["error_message"] = None
            self.history.append(f"{job_id}:completed")

    def mark_failed(self, job_id: str, error_message: str) -> None:
        with self._lock:
            job = self.jobs.setdefault(job_id, {"id": job_id})
            job["status"] = "failed"
            job["error_message"] = error_message
            self.history.append(f"{job_id}:failed")


class FakeS3Client:
    """Almacén S3 en memoria para pruebas de lectura/escritura del worker."""

    def __init__(self) -> None:
        self.objects: Dict[str, bytes] = {}

    def get_object(self, Bucket: str, Key: str) -> Dict[str, Any]:
        data = self.objects[f"{Bucket}/{Key}"]
        return {"Body": io.BytesIO(data)}

    def put_object(self, Bucket: str, Key: str, Body: bytes, ContentType: str = "") -> None:
        self.objects[f"{Bucket}/{Key}"] = Body


def _build_scientific_pdf_bytes() -> bytes:
    """Genera un PDF científico real con PyMuPDF para pruebas E2E sin mocks del extractor."""
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text(
        (72, 72),
        "# Metabolismo Basal y Nutricion\n\n"
        "El gasto energetico basal se expresa en kcal/dia y requiere control de "
        "micronutrientes en mg y ug segun la guia clinica de referencia.\n\n"
        "# Estequiometria Bioquimica\n\n"
        "La glucolisis aerobia produce 2 mol de piruvato y ATP por cada mol de glucosa.",
        fontsize=11,
    )
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def _sqs_record(message_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    return {"messageId": message_id, "body": json.dumps(body)}


def test_contract_default_deny_rejects_extra_fields_and_unknown_type():
    with pytest.raises(ValidationError):
        AsyncJobMessage(
            job_id="job-1",
            user_id="user-1",
            job_type="pdf_structure",
            payload={},
            correlation_id="corr-1",
            created_at="2026-11-24T00:00:00Z",
            unexpected_field="bypass",
        )

    with pytest.raises(ValidationError):
        AsyncJobMessage(
            job_id="job-1",
            user_id="user-1",
            job_type="shell_exec",
            payload={},
            correlation_id="corr-1",
            created_at="2026-11-24T00:00:00Z",
        )


def test_real_pdf_extraction_e2e_via_lambda_handler(monkeypatch):
    monkeypatch.setenv("S3_BUCKET", "alquimia-test-bucket")
    repo = InMemoryJobRepository()
    repo.seed("job-pdf-real", status="pending", attempts=0)

    s3 = FakeS3Client()
    s3_key = "uploads/pdfs/user-1/bioquimica.pdf"
    s3.objects[f"alquimia-test-bucket/{s3_key}"] = _build_scientific_pdf_bytes()

    event = {
        "Records": [
            _sqs_record(
                "msg-pdf-1",
                {
                    "job_id": "job-pdf-real",
                    "user_id": "user-1",
                    "job_type": "pdf_structure",
                    "payload": {"s3Key": s3_key},
                    "correlation_id": "corr-pdf-1",
                    "created_at": "2026-11-24T00:00:00Z",
                },
            )
        ]
    }

    res = lambda_handler.handler(event, None, repo=repo, s3_client=s3)
    assert res == {"batchItemFailures": []}

    job = repo.get_job("job-pdf-real")
    assert job is not None
    assert job["status"] == "completed"
    assert job["attempts"] == 1
    assert repo.history == ["job-pdf-real:processing", "job-pdf-real:completed"]

    out_key = "alquimia-test-bucket/generated/reports/user-1/job-pdf-real.json"
    assert out_key in s3.objects
    stored = json.loads(s3.objects[out_key].decode("utf-8"))
    assert stored["total_cards"] >= 1


def test_incremental_persistence_observable_mid_execution(monkeypatch):
    """Verifica que el estado 'processing' es observable en BD mientras el job aún se ejecuta."""
    monkeypatch.setenv("S3_BUCKET", "alquimia-test-bucket")
    repo = InMemoryJobRepository()
    repo.seed("job-slow-1", status="pending", attempts=0)
    s3 = FakeS3Client()

    started_evt = threading.Event()
    release_evt = threading.Event()

    def slow_report(_msg):
        started_evt.set()
        release_evt.wait(timeout=2.0)
        return {"result_url": None, "result_payload": {"ok": True}}

    monkeypatch.setattr(lambda_handler, "_process_report_job", slow_report)

    event = {
        "Records": [
            _sqs_record(
                "msg-slow-1",
                {
                    "job_id": "job-slow-1",
                    "user_id": "user-1",
                    "job_type": "progress_report",
                    "payload": {"periodDays": 30},
                    "correlation_id": "corr-slow",
                    "created_at": "2026-11-24T00:00:00Z",
                },
            )
        ]
    }

    worker_thread = threading.Thread(
        target=lambda: lambda_handler.handler(event, None, repo=repo, s3_client=s3)
    )
    worker_thread.start()

    assert started_evt.wait(timeout=2.0), "El worker no arrancó a tiempo"
    mid_state = repo.get_job("job-slow-1")
    assert mid_state is not None
    assert mid_state["status"] == "processing"

    release_evt.set()
    worker_thread.join(timeout=2.0)

    final_state = repo.get_job("job-slow-1")
    assert final_state is not None
    assert final_state["status"] == "completed"


def test_idempotency_skips_already_completed_job(monkeypatch):
    monkeypatch.setenv("S3_BUCKET", "alquimia-test-bucket")
    repo = InMemoryJobRepository()
    repo.seed("job-done-1", status="completed", attempts=1)
    s3 = FakeS3Client()

    event = {
        "Records": [
            _sqs_record(
                "msg-dup-1",
                {
                    "job_id": "job-done-1",
                    "user_id": "user-1",
                    "job_type": "progress_report",
                    "payload": {"periodDays": 7},
                    "correlation_id": "corr-dup",
                    "created_at": "2026-11-24T00:00:00Z",
                },
            )
        ]
    }

    res = lambda_handler.handler(event, None, repo=repo, s3_client=s3)
    assert res == {"batchItemFailures": []}
    assert repo.history == []


def test_partial_batch_failure_reports_only_malformed_item(monkeypatch):
    monkeypatch.setenv("S3_BUCKET", "alquimia-test-bucket")
    repo = InMemoryJobRepository()
    repo.seed("job-ok-1", status="pending", attempts=0)
    repo.seed("job-bad-1", status="pending", attempts=0)
    s3 = FakeS3Client()

    event = {
        "Records": [
            _sqs_record(
                "msg-ok-1",
                {
                    "job_id": "job-ok-1",
                    "user_id": "user-1",
                    "job_type": "progress_report",
                    "payload": {"periodDays": 15},
                    "correlation_id": "corr-ok",
                    "created_at": "2026-11-24T00:00:00Z",
                },
            ),
            {
                "messageId": "msg-bad-1",
                "body": json.dumps({"job_id": "job-bad-1", "malformed": True}),
            },
        ]
    }

    res = lambda_handler.handler(event, None, repo=repo, s3_client=s3)
    assert res == {"batchItemFailures": [{"itemIdentifier": "msg-bad-1"}]}
    assert repo.get_job("job-ok-1")["status"] == "completed"
    assert repo.get_job("job-bad-1")["status"] == "failed"
