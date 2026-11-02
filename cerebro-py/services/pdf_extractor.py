"""
Pipeline de Extracción Canónica de PDFs hacia registros DatasetRecord.
LMS Alquimia - Fase 2: Extracción y Limpieza de Ruido Editorial.
"""
import hashlib
import re
from typing import List, Union
import pymupdf
from schemas.dataset import DatasetRecord, ClinicalMetadata
from services.pdf_cleaner import crop_page_margins, is_non_pedagogical_page

def compute_sha256(text: str) -> str:
    """Calcula el hash SHA-256 de 64 caracteres de un texto normalizado."""
    normalized = re.sub(r'\s+', ' ', text.strip()).encode('utf-8')
    return hashlib.sha256(normalized).hexdigest()


def extract_pdf_to_clean_records(
    pdf_source: Union[str, bytes],
    asignatura: str,
    doc_name: str
) -> List[DatasetRecord]:
    """
    Procesa un documento PDF completo, eliminando ruido editorial y generando
    registros limpios validados con Pydantic.
    
    :param pdf_source: Ruta al archivo PDF o bytes en memoria.
    :param asignatura: Slug de la asignatura (ej. 'alimentacion-equilibrada').
    :param doc_name: Nombre del archivo de origen (ej. 'ud1-conceptos.pdf').
    :return: Lista de registros DatasetRecord listos para exportación .jsonl.
    """
    if isinstance(pdf_source, bytes):
        doc = pymupdf.open(stream=pdf_source, filetype="pdf")
    else:
        doc = pymupdf.open(pdf_source)
    records: List[DatasetRecord] = []
    record_idx = 1
    for page_num in range(len(doc)):
        page = doc[page_num]
        display_page = page_num + 1
        # 1. Extraer texto crudo para verificar si es página no lectiva
        raw_page_text = page.get_text("text")
        if is_non_pedagogical_page(raw_page_text):
            continue
        # 2. Extraer aplicando recorte de márgenes y de-hyphenation
        clean_text = crop_page_margins(page, top_margin_pct=0.08, bottom_margin_pct=0.08)
        if len(clean_text) < 40:
            continue
        # 3. Detectar si contiene tablas Markdown (| col | col |)
        has_tables = bool(re.search(r'\|.+\|.+\|', clean_text))
        
        # 4. Inferir título de sección pedagógico sin capturar fragmentos de oraciones huérfanas
        lines = [line.strip() for line in clean_text.split('\n') if line.strip()]
        clean_section = f"{doc_name.replace('.pdf', '').replace('.PDF', '')} - Pág. {display_page}"
        
        continuation_starters = (
            "es un", "son los", "desempeñan", "consiste", "que consiste", "de los", "de las",
            "en el", "en la", "para que", "por lo tanto", "así como", "y las", "y los", "con los"
        )
        
        # Buscar encabezados estructurados (#, numeración formal 1.1, UD, etc.)
        for line in lines[:6]:
            cleaned_line = re.sub(r'^[#*\-\s_]+', '', line).strip()
            if re.match(r'^(UD\s*\d+|Tema\s*\d+|Unidad\s*\d+|\d+(\.\d+)*\s+[A-ZÁÉÍÓÚ])', cleaned_line, re.IGNORECASE):
                clean_section = cleaned_line[:70]
                break
            if line.startswith('#') and len(cleaned_line) <= 70:
                clean_section = cleaned_line
                break
                
        # Si no hubo encabezado explícito, verificar si la primera línea califica como título corto
        if clean_section.startswith(f"{doc_name.replace('.pdf', '').replace('.PDF', '')} - Pág.") and lines:
            first_line = re.sub(r'^[#*\-\s_]+', '', lines[0]).strip()
            is_continuation = any(first_line.lower().startswith(s) for s in continuation_starters)
            if not is_continuation and len(first_line) <= 65 and not first_line.endswith('.') and first_line and first_line[0].isupper():
                clean_section = first_line
        # 5. Calcular metadatos clínicos
        word_count = len(clean_text.split())
        sha256_hash = compute_sha256(clean_text)
        
        # Asignar tipo estructural
        content_type = "tabla" if has_tables and clean_text.count("|") > 6 else "texto"
        # 6. Generar instancia canónica Pydantic
        record = DatasetRecord(
            id=f"{asignatura}_{display_page:03d}_{record_idx:03d}",
            parent_id=None,
            asignatura=asignatura,
            documento_origen=doc_name,
            seccion=clean_section,
            pagina_inicio=display_page,
            pagina_fin=display_page,
            idioma_origen="gl",
            idioma_procesado="es",
            contenido_markdown=clean_text,
            tipo_contenido=content_type,
            metadata=ClinicalMetadata(
                nutrientes=[],
                poblacion="general",
                num_palabras=word_count,
                contiene_tablas=has_tables,
                content_sha256=sha256_hash
            )
        )
        records.append(record)
        record_idx += 1
    doc.close()
    return records