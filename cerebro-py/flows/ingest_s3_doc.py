"""
Ingesta de un PDF desde Amazon S3 hacia las tablas del editor (/admin) en Supabase:
1. Descarga el PDF desde S3.
2. Extrae tarjetas estructuradas Markdown con PyMuPDF (extract_cards_from_pdf_bytes).
3. Inserta el documento en nutricionista.documentos y sus tarjetas en nutricionista.tarjetas.
"""
import argparse
import asyncio
import os
import sys
from pathlib import Path
from typing import Any, Dict, List

import boto3
import httpx

ROOT_DIR = Path(__file__).resolve().parents[2]
CEREBRO_DIR = ROOT_DIR / "cerebro-py"
if str(CEREBRO_DIR) not in sys.path:
    sys.path.insert(0, str(CEREBRO_DIR))

from services.health_pdf_pipeline import process_pdf_with_4_layers  # noqa: E402
from services.pdf_service import extract_cards_from_pdf_bytes  # noqa: E402


def load_env_local() -> None:
    env_path = ROOT_DIR / ".env.local"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v


def ingest_s3_pdf_to_admin(
    s3_key: str,
    carpeta: str,
    doc_name: str,
    orden: int = 1,
    pipeline_mode: str = "deterministic",
) -> Dict[str, Any]:
    load_env_local()

    bucket = os.environ["AWS_S3_BUCKET"]
    region = os.environ.get("AWS_REGION", "eu-west-1")
    supabase_url = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
    service_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

    s3 = boto3.client("s3", region_name=region)
    obj = s3.get_object(Bucket=bucket, Key=s3_key)
    pdf_bytes = obj["Body"].read()

    def _print_progress(done: int, total: int, title: str, status: str, elapsed_s: float) -> None:
        print(f"[{done}/{total}] {title[:55]} ... {status} ({elapsed_s:.2f}s)", flush=True)

    verification_report: Dict[str, Any] = {}
    if pipeline_mode in ("local_gpu", "prod_api"):
        res = asyncio.run(
            process_pdf_with_4_layers(
                pdf_bytes,
                mode=pipeline_mode,
                on_progress=_print_progress,
            )
        )
        cards = res["cards"]
        verification_report = res["verification_report"]
    else:
        cards = extract_cards_from_pdf_bytes(pdf_bytes, translate_to_es=True)
    joined_content = "\n\n".join(
        f"## {c['titulo']}\n{c['contenido']}" for c in cards
    )

    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Content-Profile": "nutricionista",
        "Accept-Profile": "nutricionista",
        "Prefer": "return=representation",
    }

    s3_uri = f"s3://{bucket}/{s3_key}"

    with httpx.Client(timeout=30.0) as client:
        # Limpiar registro previo del mismo documento si ya existe en esa carpeta
        existing_res = client.get(
            f"{supabase_url}/rest/v1/documentos",
            headers=headers,
            params={"carpeta": f"eq.{carpeta}", "nombre": f"eq.{doc_name}", "select": "id"},
        )
        if existing_res.status_code < 400:
            for old_doc in existing_res.json():
                client.delete(
                    f"{supabase_url}/rest/v1/tarjetas",
                    headers=headers,
                    params={"documento_id": f"eq.{old_doc['id']}"},
                )
                client.delete(
                    f"{supabase_url}/rest/v1/documentos",
                    headers=headers,
                    params={"id": f"eq.{old_doc['id']}"},
                )

        doc_res = client.post(
            f"{supabase_url}/rest/v1/documentos",
            headers=headers,
            json={
                "nombre": doc_name,
                "carpeta": carpeta,
                "url": s3_uri,
                "orden": orden,
                "contenido": joined_content,
            },
        )
        if doc_res.status_code >= 400:
            raise RuntimeError(f"Error insertando documento: {doc_res.status_code} {doc_res.text}")
        doc_row = doc_res.json()[0]
        doc_id = doc_row["id"]

        cards_payload: List[Dict[str, Any]] = [
            {
                "documento_id": doc_id,
                "titulo": c["titulo"],
                "contenido": c["contenido"],
                "orden": idx,
            }
            for idx, c in enumerate(cards)
        ]

        inserted = 0
        for i in range(0, len(cards_payload), 50):
            batch = cards_payload[i : i + 50]
            card_res = client.post(
                f"{supabase_url}/rest/v1/tarjetas",
                headers=headers,
                json=batch,
            )
            if card_res.status_code >= 400:
                raise RuntimeError(f"Error insertando tarjetas: {card_res.status_code} {card_res.text}")
            inserted += len(card_res.json())

    return {
        "document_id": doc_id,
        "nombre": doc_name,
        "carpeta": carpeta,
        "s3_uri": s3_uri,
        "total_cards": inserted,
        "verification_report": verification_report,
        "preview_titles": [c["titulo"] for c in cards[:5]],
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--s3-key", required=True)
    parser.add_argument("--carpeta", required=True)
    parser.add_argument("--nombre", required=True)
    parser.add_argument("--orden", type=int, default=1)
    parser.add_argument("--mode", default="deterministic", choices=["deterministic", "local_gpu", "prod_api"])
    args = parser.parse_args()

    result = ingest_s3_pdf_to_admin(
        s3_key=args.s3_key,
        carpeta=args.carpeta,
        doc_name=args.nombre,
        orden=args.orden,
        pipeline_mode=args.mode,
    )
    print(result)
