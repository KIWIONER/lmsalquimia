"""
Motor de Chunking Semántico Jerárquico (Padre / Hijo) con Inyección de Contexto.
LMS Alquimia - Fase 4: Transformación de Datos para ML.
"""
import hashlib
import re
from typing import List, Tuple
from schemas.dataset import DatasetRecord, ClinicalMetadata

def compute_sha256(text: str) -> str:
    """Calcula el hash SHA-256 de 64 caracteres de un texto normalizado."""
    normalized = re.sub(r'\s+', ' ', text.strip()).encode('utf-8')
    return hashlib.sha256(normalized).hexdigest()


def split_into_subblocks(text: str, max_words: int = 250) -> List[str]:
    """
    Divide un texto en sub-bloques pedagógicos respetando párrafos,
    tablas Markdown y listas sin partir celdas ni oraciones.
    """
    paragraphs = text.split("\n\n")
    subblocks: List[str] = []
    current_block: List[str] = []
    current_count = 0
    for p in paragraphs:
        p_clean = p.strip()
        if not p_clean:
            continue
        p_words = len(p_clean.split())
        # Si agregar este párrafo supera max_words y ya tenemos contenido, guardar bloque actual
        if current_count + p_words > max_words and current_block:
            subblocks.append("\n\n".join(current_block))
            current_block = [p_clean]
            current_count = p_words
        else:
            current_block.append(p_clean)
            current_count += p_words
    if current_block:
        subblocks.append("\n\n".join(current_block))
    return subblocks or [text]


def create_hierarchical_chunks(
    records: List[DatasetRecord]
) -> Tuple[List[DatasetRecord], List[DatasetRecord]]:
    """
    Toma una lista de DatasetRecord y genera la estructura jerárquica:
    - Lista de Chunks Padres (Macro-contexto)
    - Lista de Chunks Hijos (Micro-tarjetas con parent_id e inyección de contexto)
    
    :param records: Registros normalizados en castellano.
    :return: Tupla (padres, hijos).
    """
    parents: List[DatasetRecord] = []
    children: List[DatasetRecord] = []
    for r_idx, parent_rec in enumerate(records, start=1):
        parent_id = f"{parent_rec.asignatura}_p{parent_rec.pagina_inicio:03d}_{r_idx:03d}_padre"
        
        # 1. Crear el Macro-chunk Padre
        parent_record = DatasetRecord(
            id=parent_id,
            parent_id=None,
            asignatura=parent_rec.asignatura,
            documento_origen=parent_rec.documento_origen,
            seccion=parent_rec.seccion,
            pagina_inicio=parent_rec.pagina_inicio,
            pagina_fin=parent_rec.pagina_fin,
            idioma_origen=parent_rec.idioma_origen,
            idioma_procesado=parent_rec.idioma_procesado,
            contenido_markdown=parent_rec.contenido_markdown,
            tipo_contenido=parent_rec.tipo_contenido,
            metadata=parent_rec.metadata
        )
        parents.append(parent_record)
        # 2. Dividir el contenido del padre en micro-chunks hijos (~150-250 palabras)
        sub_paragraphs = split_into_subblocks(parent_rec.contenido_markdown, max_words=200)
        for c_idx, sub_text in enumerate(sub_paragraphs, start=1):
            if len(sub_text.strip()) < 30:
                continue
            child_id = f"{parent_id}_hijo_{c_idx:02d}"
            
            # Formatear el Context Header Injection
            asig_name = parent_rec.asignatura.replace("-", " ").title()
            context_prefix = f"[Contexto: {asig_name} > {parent_rec.seccion}]\n\n"
            enriched_content = context_prefix + sub_text
            child_word_count = len(enriched_content.split())
            child_sha256 = compute_sha256(enriched_content)
            has_table = "|" in sub_text and "-|-" in sub_text or sub_text.count("|") >= 4
            child_record = DatasetRecord(
                id=child_id,
                parent_id=parent_id,  # Vínculo estricto con el padre
                asignatura=parent_rec.asignatura,
                documento_origen=parent_rec.documento_origen,
                seccion=parent_rec.seccion,
                pagina_inicio=parent_rec.pagina_inicio,
                pagina_fin=parent_rec.pagina_fin,
                idioma_origen=parent_rec.idioma_origen,
                idioma_procesado=parent_rec.idioma_procesado,
                contenido_markdown=enriched_content,
                tipo_contenido="tabla" if has_table else "texto",
                metadata=ClinicalMetadata(
                    nutrientes=parent_rec.metadata.nutrientes,
                    poblacion=parent_rec.metadata.poblacion,
                    num_palabras=child_word_count,
                    contiene_tablas=has_table,
                    content_sha256=child_sha256
                )
            )
            children.append(child_record)
    return parents, children