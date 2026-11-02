"""
Flow Orquestador Principal de Ingesta, Transformación y Carga Idempotente.
LMS Alquimia - Fase 5: Carga e Indexación con Prefect y pgvector.
"""
from typing import List, Dict, Any, Optional
import logging
from schemas.dataset import DatasetRecord
from services.translator import normalize_records_to_spanish
from services.chunker import create_hierarchical_chunks
from services.qa_generator import generate_instruction_pairs
from services.hash_manager import (
    compute_content_hash,
    compute_embed_hash,
    classify_hash_action,
    DEFAULT_EMBEDDING_MODEL_ID
)
from services.vectorstore_supabase import SupabaseVectorRepository, VectorRecord

logger = logging.getLogger("etl_ingest_flow")

try:
    from prefect import flow, task
except ImportError:
    def task(fn=None, **kwargs):
        if fn is None:
            return lambda f: f
        return fn
    def flow(fn=None, **kwargs):
        if fn is None:
            return lambda f: f
        return fn

@task(name="Normalización Lingüística")
def task_normalize_to_spanish(records: List[DatasetRecord]) -> List[DatasetRecord]:
    """Traduce y normaliza registros del gallego original al castellano."""
    return normalize_records_to_spanish(records)
@task(name="Chunking Semántico Jerárquico")
def task_hierarchical_chunking(
    records: List[DatasetRecord]
) -> tuple[List[DatasetRecord], List[DatasetRecord]]:
    """Genera la estructura de macro-chunks padres y micro-chunks hijos."""
    return create_hierarchical_chunks(records)
@task(name="Generación de Pares QA ChatML")
def task_generate_qa_pairs(children: List[DatasetRecord]) -> List[Dict[str, Any]]:
    """Genera ejemplos supervisados en formato ChatML validados por guardrails."""
    return generate_instruction_pairs(children)

@task(name="Carga Idempotente con Doble Hash")
def task_idempotent_load(
    children: List[DatasetRecord],
    repo: SupabaseVectorRepository,
    model_id: str = DEFAULT_EMBEDDING_MODEL_ID
) -> Dict[str, int]:
    """
    Evalúa cada micro-chunk hijo contra la base de datos aplicando la máquina de estados:
    - SKIP: Fragmento idéntico en contenido y vector (cero cómputo).
    - UPSERT_TEXT_AND_VECTOR: Nuevo chunk o texto modificado en el libro.
    - BACKFILL_VECTOR_ONLY: Texto intacto, pero se actualiza el vector.
    """
    chunk_ids = [c.id for c in children]
    existing_hashes = repo.get_existing_hashes(chunk_ids)
    
    stats = {
        "skipped": 0,
        "upserted": 0,
        "backfilled": 0,
        "total_evaluated": len(children)
    }
    
    for child in children:
        c_hash = compute_content_hash(child.contenido_markdown)
        e_hash = compute_embed_hash(c_hash, model_id=model_id)
        
        exist_c_hash, exist_e_hash = existing_hashes.get(child.id, (None, None))
        action = classify_hash_action(exist_c_hash, exist_e_hash, c_hash, e_hash)
        
        if action == "SKIP":
            stats["skipped"] += 1
            continue
            
        elif action == "BACKFILL_VECTOR_ONLY":
            # Simular embedding de 1024 dimensiones para BAAI/bge-m3
            simulated_vec = [0.01] * 1024
            repo.backfill_embedding(child.id, e_hash, simulated_vec)
            stats["backfilled"] += 1
            
        elif action == "UPSERT_TEXT_AND_VECTOR":
            simulated_vec = [0.01] * 1024
            vec_rec = VectorRecord(
                id=child.id,
                parent_id=child.parent_id,
                asignatura=child.asignatura,
                documento_origen=child.documento_origen,
                seccion=child.seccion,
                pagina_inicio=child.pagina_inicio,
                pagina_fin=child.pagina_fin,
                contenido_markdown=child.contenido_markdown,
                content_hash=c_hash,
                embed_hash=e_hash,
                metadata={
                    "nutrientes": child.metadata.nutrientes,
                    "poblacion": child.metadata.poblacion,
                    "contiene_tablas": child.metadata.contiene_tablas
                },
                embedding=simulated_vec
            )
            repo.upsert_chunk(vec_rec)
            stats["upserted"] += 1
            
    return stats


@flow(name="LMS Alquimia - ETL Pipeline Ingesta")
def run_etl_pipeline(
    records: List[DatasetRecord],
    repo: Optional[SupabaseVectorRepository] = None,
    model_id: str = DEFAULT_EMBEDDING_MODEL_ID
) -> Dict[str, Any]:
    """
    Punto de entrada orquestado que ejecuta el pipeline ETL completo con idempotencia.
    
    :param records: Registros extraídos en gallego.
    :param repo: Repositorio Supabase pgvector (se crea uno por defecto si no se pasa).
    :param model_id: Modelo de embeddings utilizado.
    :return: Diccionario con métricas de ejecución y artefactos generados.
    """
    if repo is None:
        repo = SupabaseVectorRepository()
        
    # 1. Normalizar a castellano
    es_records = task_normalize_to_spanish(records)
    
    # 2. Chunking Jerárquico Padre/Hijo
    parents, children = task_hierarchical_chunking(es_records)
    
    # 3. Pares de Instrucción ChatML
    chatml_pairs = task_generate_qa_pairs(children)
    
    # 4. Carga Idempotente con Doble Hash
    load_stats = task_idempotent_load(children, repo, model_id=model_id)
    
    return {
        "status": "SUCCESS",
        "parents_count": len(parents),
        "children_count": len(children),
        "chatml_pairs_count": len(chatml_pairs),
        "load_stats": load_stats
    }