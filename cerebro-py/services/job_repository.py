import os
from typing import Any, Dict, Optional, Protocol
import httpx


class JobRepository(Protocol):
    """Interfaz para persistencia incremental e idempotencia de async_jobs."""

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        ...

    def mark_processing(self, job_id: str, attempts: int) -> None:
        ...

    def mark_completed(
        self,
        job_id: str,
        result_url: Optional[str] = None,
        result_payload: Optional[Dict[str, Any]] = None,
    ) -> None:
        ...

    def mark_failed(self, job_id: str, error_message: str) -> None:
        ...


class SupabaseJobRepository:
    """Repositorio PostgREST ligero para actualizar public.async_jobs desde AWS Lambda."""

    def __init__(
        self,
        supabase_url: Optional[str] = None,
        service_role_key: Optional[str] = None,
    ) -> None:
        self.supabase_url = (supabase_url or os.getenv("SUPABASE_URL") or "").rstrip("/")
        self.service_role_key = (
            service_role_key
            or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            or os.getenv("SUPABASE_SECRET_KEY")
            or ""
        )
        if not self.supabase_url or not self.service_role_key:
            raise ValueError(
                "SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY son obligatorios."
            )

    def _headers(self) -> Dict[str, str]:
        return {
            "apikey": self.service_role_key,
            "Authorization": f"Bearer {self.service_role_key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        }

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        url = f"{self.supabase_url}/rest/v1/async_jobs"
        params = {"id": f"eq.{job_id}", "select": "id,status,attempts,result_url"}
        with httpx.Client(timeout=10.0) as client:
            res = client.get(url, headers=self._headers(), params=params)
            res.raise_for_status()
            rows = res.json()
            return rows[0] if rows else None

    def mark_processing(self, job_id: str, attempts: int) -> None:
        self._patch_job(job_id, {"status": "processing", "attempts": attempts})

    def mark_completed(
        self,
        job_id: str,
        result_url: Optional[str] = None,
        result_payload: Optional[Dict[str, Any]] = None,
    ) -> None:
        body: Dict[str, Any] = {"status": "completed", "error_message": None}
        if result_url is not None:
            body["result_url"] = result_url
        if result_payload is not None:
            body["result_payload"] = result_payload
        self._patch_job(job_id, body)

    def mark_failed(self, job_id: str, error_message: str) -> None:
        self._patch_job(
            job_id,
            {"status": "failed", "error_message": error_message[:1000]},
        )

    def _patch_job(self, job_id: str, payload: Dict[str, Any]) -> None:
        url = f"{self.supabase_url}/rest/v1/async_jobs"
        params = {"id": f"eq.{job_id}"}
        with httpx.Client(timeout=10.0) as client:
            res = client.patch(url, headers=self._headers(), params=params, json=payload)
            res.raise_for_status()
