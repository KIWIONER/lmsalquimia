"""
Esquema Canónico Pydantic v2 para Dataset de Machine Learning y Vectorstore.
LMS Alquimia - Módulo Cerebro Python Core.
"""
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Literal
import re

class ClinicalMetadata(BaseModel):
    """Metadatos clínicos y propiedades técnicas del fragmento."""
    nutrientes: List[str] = Field(
        default_factory=list, 
        description="Lista de nutrientes o compuestos detectados (NER)"
    )
    poblacion: str = Field(
        default="general", 
        description="Población diana: general, pediatria, geriatria, embarazo, lactancia, etc."
    )
    num_palabras: int = Field(
        ..., 
        ge=1, 
        description="Conteo exacto de palabras en el fragmento"
    )
    contiene_tablas: bool = Field(
        default=False, 
        description="Indica si el fragmento contiene al menos una tabla Markdown"
    )
    content_sha256: str = Field(
        ..., 
        min_length=64, 
        max_length=64, 
        description="Hash criptográfico SHA-256 del texto canónico normalizado"
    )
    @field_validator("content_sha256")
    @classmethod
    def validate_sha256_format(cls, v: str) -> str:
        """Asegura que el hash sea hexadecimal válido de 64 caracteres."""
        if not re.fullmatch(r"[0-9a-fA-F]{64}", v):
            raise ValueError("content_sha256 debe ser una cadena hexadecimal de 64 caracteres")
        return v.lower()


class DatasetRecord(BaseModel):
    """Registro canónico individual para líneas del dataset (.jsonl)."""
    id: str = Field(
        ..., 
        min_length=5, 
        description="Identificador único del registro: {asig}_{ud}_{tipo}_{index}"
    )
    parent_id: Optional[str] = Field(
        default=None, 
        description="Puntero al macro-chunk padre para mantener la jerarquía de contexto"
    )
    asignatura: str = Field(
        ..., 
        min_length=3, 
        description="Slug de la asignatura (ej. alimentacion-equilibrada)"
    )
    documento_origen: str = Field(
        ..., 
        min_length=4, 
        description="Nombre del archivo PDF original fuente de donde se extrajo"
    )
    seccion: str = Field(
        ..., 
        min_length=2, 
        description="Título de la sección o epígrafe temático"
    )
    pagina_inicio: int = Field(
        ..., 
        ge=1, 
        description="Número de página inicial en el PDF original"
    )
    pagina_fin: int = Field(
        ..., 
        ge=1, 
        description="Número de página final en el PDF original"
    )
    idioma_origen: Literal["gl"] = Field(
        default="gl", 
        description="Idioma original del documento (Gallego)"
    )
    idioma_procesado: Literal["es"] = Field(
        default="es", 
        description="Idioma normalizado de salida para entrenamiento y RAG (Castellano)"
    )
    contenido_markdown: str = Field(
        ..., 
        min_length=40, 
        description="Contenido limpio y estructurado en sintaxis Markdown GFM"
    )
    tipo_contenido: Literal["texto", "tabla", "texto_con_tablas", "formula"] = Field(
        ..., 
        description="Tipología estructural del bloque pedagógico"
    )
    metadata: ClinicalMetadata
    @field_validator("pagina_fin")
    @classmethod
    def validate_page_range(cls, v: int, info) -> int:
        """Asegura que la página final sea mayor o igual a la inicial."""
        start_page = info.data.get("pagina_inicio")
        if start_page is not None and v < start_page:
            raise ValueError(f"pagina_fin ({v}) no puede ser menor que pagina_inicio ({start_page})")
        return v