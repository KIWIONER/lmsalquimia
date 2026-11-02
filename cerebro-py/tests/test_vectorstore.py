"""
Tests Unitarios para el Repositorio de Supabase pgvector, Doble Hash y Flow ETL.
LMS Alquimia - Fase 5: Carga e Indexación con Prefect y pgvector.
"""

import pytest
from schemas.dataset import DatasetRecord, ClinicalMetadata
from services.hash_manager import (
    compute_content_hash,
    compute_embed_hash,
    classify_hash_action
)
from services.vectorstore_supabase import SupabaseVectorRepository, VectorRecord
from flows.etl_ingest_flow import run_etl_pipeline


@pytest.fixture
def sample_dataset_record() -> DatasetRecord:
    """Fixture de un registro en gallego para validar el flow completo."""
    raw_text = (
        "O aporte de proteínas de alto valor biolóxico debe acadar un mínimo de 0.8 g/kg/día "
        "en adultos sans para preservar a masa muscular libre de graxa.\n\n"
        "En poboacións geriátricas ou con sarcopenia, a inxesta pode incrementarse ata 1.2 g/kg/día."
    )
    return DatasetRecord(
        id="diet_test_p001_001",
        parent_id=None,
        asignatura="dietoterapia",
        documento_origen="modulo_proteinas.pdf",
        seccion="1.3 Requerementos Proteicos",
        pagina_inicio=8,
        pagina_fin=9,
        idioma_origen="gl",
        idioma_procesado="es",
        contenido_markdown=raw_text,
        tipo_contenido="texto",
        metadata=ClinicalMetadata(
            nutrientes=["proteina"],
            poblacion="general",
            num_palabras=len(raw_text.split()),
            contiene_tablas=False,
            content_sha256="a" * 64
        )
    )


def test_double_hash_properties():
    """Valida la independencia del content_hash y la sensibilidad del embed_hash."""
    text_a = "Recomendación de 15 mg de zinc diarios."
    text_a_whitespace = "  Recomendación   de  15  mg   de zinc diarios.  \n"
    text_b = "Recomendación de 20 mg de zinc diarios."
    
    # Normalización de espacios
    hash_a = compute_content_hash(text_a)
    assert hash_a == compute_content_hash(text_a_whitespace)
    assert len(hash_a) == 64
    
    # Texto diferente genera content_hash diferente
    hash_b = compute_content_hash(text_b)
    assert hash_a != hash_b
    
    # Mismo texto con modelos distintos genera embed_hashes distintos
    embed_v1 = compute_embed_hash(hash_a, model_id="BAAI/bge-m3", prompt_version="v1")
    embed_v2 = compute_embed_hash(hash_a, model_id="BAAI/bge-m3", prompt_version="v2")
    embed_diff_model = compute_embed_hash(hash_a, model_id="text-embedding-3-small", prompt_version="v1")
    
    assert len(embed_v1) == 64
    assert embed_v1 != embed_v2
    assert embed_v1 != embed_diff_model


def test_hash_action_classifier_scenarios():
    """Valida los 3 escenarios de la máquina de estados de idempotencia."""
    c_hash = "1111" * 16
    e_hash_v1 = "2222" * 16
    e_hash_v2 = "3333" * 16
    new_c_hash = "4444" * 16
    
    # Escenario 1: Fragmento nuevo en la base de datos
    assert classify_hash_action(None, None, c_hash, e_hash_v1) == "UPSERT_TEXT_AND_VECTOR"
    
    # Escenario 2: Texto modificado en el libro
    assert classify_hash_action(c_hash, e_hash_v1, new_c_hash, e_hash_v1) == "UPSERT_TEXT_AND_VECTOR"
    
    # Escenario 3: Fragmento exactamente idéntico (SKIP)
    assert classify_hash_action(c_hash, e_hash_v1, c_hash, e_hash_v1) == "SKIP"
    
    # Escenario 4: Backfill quirúrgico (texto igual, pero embedding actualizado)
    assert classify_hash_action(c_hash, e_hash_v1, c_hash, e_hash_v2) == "BACKFILL_VECTOR_ONLY"


def test_supabase_vector_repository_operations():
    """Valida upsert, consulta de hashes y backfill sin mutar el texto."""
    repo = SupabaseVectorRepository()
    c_hash = compute_content_hash("Aporte hídrico basal de 2000 ml")
    e_hash = compute_embed_hash(c_hash, model_id="BAAI/bge-m3")
    
    record = VectorRecord(
        id="chunk_renal_001",
        parent_id=None,
        asignatura="dietoterapia",
        documento_origen="u2.pdf",
        seccion="Balance Hídrico",
        pagina_inicio=10,
        pagina_fin=10,
        contenido_markdown="Aporte hídrico basal de 2000 ml",
        content_hash=c_hash,
        embed_hash=e_hash,
        metadata={"nutrientes": ["agua"]},
        embedding=[0.05] * 1024
    )
    
    # Upsert
    assert repo.upsert_chunk(record) is True
    assert repo.count_records() == 1
    
    # Consulta de hashes
    hashes = repo.get_existing_hashes(["chunk_renal_001", "inexistente"])
    assert "chunk_renal_001" in hashes
    assert "inexistente" not in hashes
    assert hashes["chunk_renal_001"] == (c_hash, e_hash)
    
    # Backfill quirúrgico
    new_e_hash = compute_embed_hash(c_hash, model_id="BAAI/bge-m3", prompt_version="v2")
    new_embedding = [0.99] * 1024
    assert repo.backfill_embedding("chunk_renal_001", new_e_hash, new_embedding) is True
    
    # Comprobar que el texto y content_hash siguen intactos tras el backfill
    retrieved = repo.search_by_id("chunk_renal_001")
    assert retrieved.content_hash == c_hash
    assert retrieved.contenido_markdown == "Aporte hídrico basal de 2000 ml"
    assert retrieved.embed_hash == new_e_hash
    assert retrieved.embedding[0] == 0.99


def test_etl_ingest_flow_idempotency(sample_dataset_record: DatasetRecord):
    """Comprueba que una re-ejecución del pipeline haga SKIP al 100% de los chunks."""
    repo = SupabaseVectorRepository()
    
    # 1. Primera corrida: Carga inicial (UPSERT)
    res_run1 = run_etl_pipeline([sample_dataset_record], repo=repo)
    assert res_run1["status"] == "SUCCESS"
    assert res_run1["load_stats"]["upserted"] > 0
    assert res_run1["load_stats"]["skipped"] == 0
    total_evaluated = res_run1["load_stats"]["total_evaluated"]
    
    # 2. Segunda corrida con los mismos datos: Idempotencia (SKIP)
    res_run2 = run_etl_pipeline([sample_dataset_record], repo=repo)
    assert res_run2["status"] == "SUCCESS"
    assert res_run2["load_stats"]["upserted"] == 0
    assert res_run2["load_stats"]["skipped"] == total_evaluated
    assert res_run2["load_stats"]["backfilled"] == 0