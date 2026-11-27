"""
Repositorio Vectorial Desacoplado con Búsqueda Híbrida (Densa + Dispersa) e Idempotencia Doble-Hash.
LMS Alquimia - Fase 2: RAG Científico en Qdrant.
"""
import hashlib
import math
import re
from typing import Any, Dict, List, Optional, Protocol, Tuple
import httpx
from pydantic import BaseModel, Field

from config import QDRANT_API_KEY, QDRANT_COLLECTION, QDRANT_URL


def tokenize_scientific_terms(text: str) -> List[str]:
    """Tokenizador determinista que preserva unidades y fórmulas (mmol/L, µg, ATP, CYP3A4)."""
    return re.findall(r"[a-zA-Z0-9µμ]+(?:[/_-][a-zA-Z0-9µμ]+)*", text.lower())


def compute_deterministic_dense_vector(text: str, dim: int = 64) -> List[float]:
    """Vector denso determinista ligero (útil para tests herméticos y fallback sin GPU)."""
    vec = [0.0] * dim
    tokens = tokenize_scientific_terms(text)
    if not tokens:
        return vec
    for tok in tokens:
        digest = hashlib.sha256(tok.encode("utf-8")).digest()
        idx = int.from_bytes(digest[:2], "big") % dim
        sign = 1.0 if (digest[2] & 1) == 0 else -1.0
        vec[idx] += sign
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [round(v / norm, 6) for v in vec]


def compute_sparse_terms(text: str) -> Dict[str, float]:
    """Representación dispersa TF normalizada para términos científicos exactos."""
    tokens = tokenize_scientific_terms(text)
    if not tokens:
        return {}
    counts: Dict[str, int] = {}
    for t in tokens:
        counts[t] = counts.get(t, 0) + 1
    total = float(len(tokens))
    return {t: round(c / total, 6) for t, c in counts.items()}


class HybridVectorRecord(BaseModel):
    id: str
    parent_id: Optional[str] = None
    rama_cientifica: str = "nutricion"
    asignatura: str = "general"
    documento_origen: str = ""
    unidad: str = ""
    pagina_inicio: int = 1
    pagina_fin: int = 1
    contenido_markdown: str
    content_hash: str
    embed_hash: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    embedding: Optional[List[float]] = None
    sparse_terms: Optional[Dict[str, float]] = None


class VectorRepository(Protocol):
    def get_existing_hashes(self, chunk_ids: List[str]) -> Dict[str, Tuple[str, str]]:
        ...

    def upsert_chunk(self, record: HybridVectorRecord) -> bool:
        ...

    def backfill_embedding(
        self, chunk_id: str, new_embed_hash: str, embedding: List[float]
    ) -> bool:
        ...

    def hybrid_search(
        self,
        query_text: str,
        top_k: int = 5,
        filters: Optional[Dict[str, str]] = None,
    ) -> List[Dict[str, Any]]:
        ...


class InMemoryVectorRepository:
    """Implementación en memoria con scoring híbrido (coseno denso + sparse exacto) para tests."""

    def __init__(self) -> None:
        self._store: Dict[str, HybridVectorRecord] = {}

    def get_existing_hashes(self, chunk_ids: List[str]) -> Dict[str, Tuple[str, str]]:
        return {
            cid: (self._store[cid].content_hash, self._store[cid].embed_hash)
            for cid in chunk_ids
            if cid in self._store
        }

    def upsert_chunk(self, record: HybridVectorRecord) -> bool:
        if record.embedding is None:
            record.embedding = compute_deterministic_dense_vector(record.contenido_markdown)
        if record.sparse_terms is None:
            record.sparse_terms = compute_sparse_terms(record.contenido_markdown)
        self._store[record.id] = record
        return True

    def backfill_embedding(
        self, chunk_id: str, new_embed_hash: str, embedding: List[float]
    ) -> bool:
        if chunk_id not in self._store:
            return False
        rec = self._store[chunk_id]
        rec.embed_hash = new_embed_hash
        rec.embedding = embedding
        return True

    def hybrid_search(
        self,
        query_text: str,
        top_k: int = 5,
        filters: Optional[Dict[str, str]] = None,
    ) -> List[Dict[str, Any]]:
        q_dense = compute_deterministic_dense_vector(query_text)
        q_sparse = compute_sparse_terms(query_text)

        scored: List[Tuple[float, HybridVectorRecord]] = []
        for rec in self._store.values():
            if filters and not _matches_filters(rec, filters):
                continue

            dense_vec = rec.embedding or compute_deterministic_dense_vector(rec.contenido_markdown)
            dense_score = sum(a * b for a, b in zip(q_dense, dense_vec))

            sparse_vec = rec.sparse_terms or compute_sparse_terms(rec.contenido_markdown)
            sparse_score = sum(q_sparse.get(k, 0.0) * v for k, v in sparse_vec.items())

            # Combinación híbrida ponderada: semántica + coincidencia exacta científica
            hybrid_score = 0.4 * dense_score + 0.6 * min(1.0, sparse_score * 5.0)
            scored.append((hybrid_score, rec))

        scored.sort(key=lambda item: item[0], reverse=True)
        return [
            {
                "id": rec.id,
                "score": round(score, 4),
                "rama_cientifica": rec.rama_cientifica,
                "asignatura": rec.asignatura,
                "documento_origen": rec.documento_origen,
                "pagina_inicio": rec.pagina_inicio,
                "contenido_markdown": rec.contenido_markdown,
            }
            for score, rec in scored[:top_k]
        ]


class QdrantVectorRepository:
    """Cliente REST para Qdrant con soporte híbrido (vectores densos + payload indexes)."""

    def __init__(
        self,
        url: str = QDRANT_URL,
        api_key: str = QDRANT_API_KEY,
        collection: str = QDRANT_COLLECTION,
        vector_size: int = 64,
    ) -> None:
        self.url = url.rstrip("/")
        self.api_key = api_key
        self.collection = collection
        self.vector_size = vector_size

    def _headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["api-key"] = self.api_key
        return headers

    def ensure_collection(self) -> None:
        with httpx.Client(timeout=10.0) as client:
            res = client.get(
                f"{self.url}/collections/{self.collection}",
                headers=self._headers(),
            )
            if res.status_code == 404:
                client.put(
                    f"{self.url}/collections/{self.collection}",
                    headers=self._headers(),
                    json={
                        "vectors": {"size": self.vector_size, "distance": "Cosine"},
                    },
                ).raise_for_status()
                for field_name in ("rama_cientifica", "asignatura", "documento_origen"):
                    client.put(
                        f"{self.url}/collections/{self.collection}/index",
                        headers=self._headers(),
                        json={"field_name": field_name, "field_schema": "keyword"},
                    )

    def get_existing_hashes(self, chunk_ids: List[str]) -> Dict[str, Tuple[str, str]]:
        if not chunk_ids:
            return {}
        with httpx.Client(timeout=10.0) as client:
            res = client.post(
                f"{self.url}/collections/{self.collection}/points",
                headers=self._headers(),
                json={"ids": chunk_ids, "with_payload": ["content_hash", "embed_hash"]},
            )
            if res.status_code != 200:
                return {}
            out: Dict[str, Tuple[str, str]] = {}
            for pt in res.json().get("result", []):
                payload = pt.get("payload", {})
                if "content_hash" in payload and "embed_hash" in payload:
                    out[str(pt["id"])] = (payload["content_hash"], payload["embed_hash"])
            return out

    def upsert_chunk(self, record: HybridVectorRecord) -> bool:
        dense_vec = record.embedding or compute_deterministic_dense_vector(
            record.contenido_markdown, dim=self.vector_size
        )
        sparse = record.sparse_terms or compute_sparse_terms(record.contenido_markdown)
        with httpx.Client(timeout=10.0) as client:
            res = client.put(
                f"{self.url}/collections/{self.collection}/points",
                headers=self._headers(),
                json={
                    "points": [
                        {
                            "id": record.id,
                            "vector": dense_vec,
                            "payload": {
                                "parent_id": record.parent_id,
                                "rama_cientifica": record.rama_cientifica,
                                "asignatura": record.asignatura,
                                "documento_origen": record.documento_origen,
                                "unidad": record.unidad,
                                "pagina_inicio": record.pagina_inicio,
                                "pagina_fin": record.pagina_fin,
                                "contenido_markdown": record.contenido_markdown,
                                "content_hash": record.content_hash,
                                "embed_hash": record.embed_hash,
                                "sparse_terms": sparse,
                            },
                        }
                    ]
                },
            )
            res.raise_for_status()
            return True

    def backfill_embedding(
        self, chunk_id: str, new_embed_hash: str, embedding: List[float]
    ) -> bool:
        with httpx.Client(timeout=10.0) as client:
            res = client.post(
                f"{self.url}/collections/{self.collection}/points/payload",
                headers=self._headers(),
                json={"payload": {"embed_hash": new_embed_hash}, "points": [chunk_id]},
            )
            res.raise_for_status()
            return True

    def hybrid_search(
        self,
        query_text: str,
        top_k: int = 5,
        filters: Optional[Dict[str, str]] = None,
    ) -> List[Dict[str, Any]]:
        q_dense = compute_deterministic_dense_vector(query_text, dim=self.vector_size)
        q_sparse = compute_sparse_terms(query_text)

        qdrant_filter = None
        if filters:
            qdrant_filter = {
                "must": [
                    {"key": k, "match": {"value": v}}
                    for k, v in filters.items()
                    if v
                ]
            }

        with httpx.Client(timeout=10.0) as client:
            res = client.post(
                f"{self.url}/collections/{self.collection}/points/search",
                headers=self._headers(),
                json={
                    "vector": q_dense,
                    "filter": qdrant_filter,
                    "limit": max(top_k * 2, 10),
                    "with_payload": True,
                },
            )
            res.raise_for_status()
            candidates = res.json().get("result", [])

        reranked: List[Tuple[float, Dict[str, Any]]] = []
        for item in candidates:
            payload = item.get("payload", {})
            dense_score = float(item.get("score", 0.0))
            sparse_vec = payload.get("sparse_terms", {})
            sparse_score = sum(q_sparse.get(k, 0.0) * float(v) for k, v in sparse_vec.items())
            hybrid_score = 0.4 * dense_score + 0.6 * min(1.0, sparse_score * 5.0)
            reranked.append(
                (
                    hybrid_score,
                    {
                        "id": str(item.get("id")),
                        "score": round(hybrid_score, 4),
                        "rama_cientifica": payload.get("rama_cientifica"),
                        "asignatura": payload.get("asignatura"),
                        "documento_origen": payload.get("documento_origen"),
                        "pagina_inicio": payload.get("pagina_inicio"),
                        "contenido_markdown": payload.get("contenido_markdown", ""),
                    },
                )
            )
        reranked.sort(key=lambda x: x[0], reverse=True)
        return [entry for _, entry in reranked[:top_k]]


def _matches_filters(rec: HybridVectorRecord, filters: Dict[str, str]) -> bool:
    for key, expected in filters.items():
        if not expected:
            continue
        if getattr(rec, key, None) != expected:
            return False
    return True
