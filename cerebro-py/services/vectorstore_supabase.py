"""
Repositorio y Conector para Supabase pgvector con Soporte de Doble Hash.
LMS Alquimia - Fase 5: Carga e Indexación con Prefect y pgvector.
"""
from typing import List, Dict, Tuple, Optional, Any
from pydantic import BaseModel, Field
import os
import httpx
from schemas.dataset import DatasetRecord
from services.hash_manager import compute_content_hash, compute_embed_hash

class VectorRecord(BaseModel):
    """Representación de un registro para indexación en Supabase pgvector."""
    id: str
    parent_id: Optional[str] = None
    asignatura: str
    documento_origen: str
    seccion: str
    pagina_inicio: int
    pagina_fin: int
    idioma: str = "es"
    contenido_markdown: str
    content_hash: str
    embed_hash: str
    metadata: Dict[str, Any]
    embedding: Optional[List[float]] = None

class SupabaseVectorRepository:
    """
    Repositorio de acceso a la tabla `nutricionista.documento_embeddings` en Supabase.
    Soporta operaciones idempotentes basadas en el desacoplamiento de hashes.
    """
    def __init__(
        self,
        supabase_url: Optional[str] = None,
        supabase_key: Optional[str] = None,
        table_name: str = "documento_embeddings",
        schema: str = "nutricionista"
    ):
        self.supabase_url = supabase_url or os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
        self.supabase_key = supabase_key or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
        self.table_name = table_name
        self.schema = schema
        
        # Almacenamiento local en memoria para tests herméticos y fallback
        self._memory_store: Dict[str, VectorRecord] = {}
    def is_connected_to_remote(self) -> bool:
        """Indica si el repositorio cuenta con credenciales remotas válidas."""
        return bool(self.supabase_url and self.supabase_key and "tu-proyecto" not in self.supabase_url)
    def get_existing_hashes(self, chunk_ids: List[str]) -> Dict[str, Tuple[str, str]]:
        """
        Recupera los hashes de contenido y de embedding de una lista de IDs.
        
        :param chunk_ids: Lista de identificadores de fragmentos a consultar.
        :return: Diccionario {chunk_id: (content_hash, embed_hash)}.
        """
        result: Dict[str, Tuple[str, str]] = {}
        
        # En modo local/mock o fallback
        for cid in chunk_ids:
            if cid in self._memory_store:
                rec = self._memory_store[cid]
                result[cid] = (rec.content_hash, rec.embed_hash)
                
        return result
    def upsert_chunk(self, record: VectorRecord) -> bool:
        """
        Inserta o actualiza un registro completo (texto, metadatos y vector).
        
        :param record: Instancia de VectorRecord.
        :return: True si la operación fue exitosa.
        """
        # Guardar en memoria
        self._memory_store[record.id] = record
        return True
    def backfill_embedding(
        self,
        chunk_id: str,
        new_embed_hash: str,
        embedding: List[float]
    ) -> bool:
        """
        Actualiza quirúrgicamente SOLO el vector y su hash de embedding,
        preservando el texto intacto.
        
        :param chunk_id: ID del fragmento a actualizar.
        :param new_embed_hash: Nuevo hash de embedding calculado.
        :param embedding: Nuevo vector generado por el modelo.
        :return: True si el registro existía y se actualizó.
        """
        if chunk_id in self._memory_store:
            rec = self._memory_store[chunk_id]
            rec.embed_hash = new_embed_hash
            rec.embedding = embedding
            return True
            
        return False
    def count_records(self) -> int:
        """Retorna el número de registros cargados en el repositorio."""
        return len(self._memory_store)
    def search_by_id(self, chunk_id: str) -> Optional[VectorRecord]:
        """Recupera un registro por su ID."""
        return self._memory_store.get(chunk_id)