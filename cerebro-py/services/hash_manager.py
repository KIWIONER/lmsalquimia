"""
Motor de Doble Hash Desacoplado e Idempotencia Quirúrgica.
LMS Alquimia - Fase 5: Carga e Indexación con Prefect y pgvector.
"""
import hashlib
import re
from typing import Optional, Literal
# Configuración por defecto para el stack oficial de LMS Alquimia
DEFAULT_EMBEDDING_MODEL_ID = "BAAI/bge-m3"
DEFAULT_PROMPT_VERSION = "v1.0.0-context-injection"
HashAction = Literal["SKIP", "UPSERT_TEXT_AND_VECTOR", "BACKFILL_VECTOR_ONLY"]


def compute_content_hash(text: str) -> str:
    """
    Calcula el hash criptográfico SHA-256 de 64 caracteres de un texto,
    normalizando espacios en blanco colapsados para garantizar idempotencia.
    """
    normalized = re.sub(r'\s+', ' ', text.strip()).encode('utf-8')
    return hashlib.sha256(normalized).hexdigest()


def compute_embed_hash(
    content_hash: str,
    model_id: str = DEFAULT_EMBEDDING_MODEL_ID,
    prompt_version: str = DEFAULT_PROMPT_VERSION
) -> str:
    """
    Calcula el hash de vectorización combinando el hash de contenido con
    el identificador del modelo y la versión del prompt contextual.
    """
    composite_key = f"{content_hash.lower()}:{model_id.strip()}:{prompt_version.strip()}".encode('utf-8')
    return hashlib.sha256(composite_key).hexdigest()


def classify_hash_action(
    existing_content_hash: Optional[str],
    existing_embed_hash: Optional[str],
    new_content_hash: str,
    new_embed_hash: str
) -> HashAction:
    """
    Determina la acción quirúrgica a realizar según la comparativa de hashes:
    
    1. Si no existe en BD o el texto cambió: 'UPSERT_TEXT_AND_VECTOR'
    2. Si el texto no cambió pero el modelo/prompt cambió: 'BACKFILL_VECTOR_ONLY'
    3. Si ambos hashes son idénticos a los de BD: 'SKIP'
    """
    # Caso 1: Nuevo fragmento o contenido modificado en el libro
    if not existing_content_hash or existing_content_hash.lower() != new_content_hash.lower():
        return "UPSERT_TEXT_AND_VECTOR"
        
    # Caso 2: Contenido idéntico, pero el embedding no existe o cambió el modelo/prompt
    if not existing_embed_hash or existing_embed_hash.lower() != new_embed_hash.lower():
        return "BACKFILL_VECTOR_ONLY"
        
    # Caso 3: Todo idéntico, fragmento intacto
    return "SKIP"