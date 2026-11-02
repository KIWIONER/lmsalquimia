"""
Suite de Pruebas Unitarias para el Pipeline de Extracción y Limpieza de PDFs.
LMS Alquimia - Fase 2: Extracción y Limpieza de Ruido Editorial.
"""
import pytest
import pymupdf
from services.pdf_cleaner import clean_hyphenation_and_newlines, is_non_pedagogical_page, crop_page_margins
from services.pdf_extractor import extract_pdf_to_clean_records, compute_sha256

def test_hyphenation_reconstruction():
    """Verifica que las palabras partidas se unen y los guiones de nutrientes se preservan."""
    raw = "O me-\ntabolismo dos lípidos e ácidos graxos omega-3 na di-\nexestión."
    cleaned = clean_hyphenation_and_newlines(raw)
    assert "metabolismo" in cleaned
    assert "omega-3" in cleaned
    assert "diexestión" in cleaned

def test_preliminary_page_filtering():
    """Verifica la exclusión de páginas de ISBN/derechos y retención de materia de estudio."""
    legal_page = "Xunta de Galicia. ISBN: 978-84-12345-67-8. Depósito Legal: C-123-2024. Todos os dereitos reservados."
    assert is_non_pedagogical_page(legal_page) is True
    index_page = "Sumario do Módulo\nTema 1 ........... 5\nTema 2 ........... 15\nTema 3 ........... 25\nTema 4 ........... 35"
    assert is_non_pedagogical_page(index_page) is True
    real_content = "Os glícidos son a fonte primaria de enerxía metabólica inmediata para o sistema nervioso central e os eritrocitos."
    assert is_non_pedagogical_page(real_content) is False


def test_pdf_extraction_pipeline_with_bbox_crop():
    """Crea un PDF en memoria y verifica que el extractor descarta cabeceras y genera DatasetRecord válidos."""
    doc = pymupdf.open()
    
    # Página 1: Copyright (descartada)
    p1 = doc.new_page()
    p1.insert_text((50, 100), "ISBN: 978-84-1234-56-7. Depósito Legal VG-2024. Todos os dereitos reservados.")
    
    # Página 2: Lectiva (con cabecera en y=20 y pie en y=800)
    p2 = doc.new_page()
    p2.insert_text((50, 20), "CABECERA EDITORIAL REPETITIVA QUE DEBE DESAPARECER")
    p2.insert_text((50, 250), "## 2.1 Requerementos Enerxéticos\nO gasto enerxético total calcúlase sumando a taxa metabólica basal e o factor de actividade física.")
    p2.insert_text((50, 800), "- 14 -")
    
    pdf_bytes = doc.tobytes()
    doc.close()
    
    records = extract_pdf_to_clean_records(pdf_bytes, "alimentacion-equilibrada", "modulo1.pdf")
    
    assert len(records) == 1
    rec = records[0]
    assert rec.asignatura == "alimentacion-equilibrada"
    assert rec.pagina_inicio == 2
    assert "CABECERA EDITORIAL" not in rec.contenido_markdown
    assert "- 14 -" not in rec.contenido_markdown
    assert "Requerementos Enerxéticos" in rec.contenido_markdown
    assert len(rec.metadata.content_sha256) == 64

def test_sha256_reproducibility():
    """Verifica que el hash SHA-256 es idéntico e independiente de espacios en blanco irrelevantes."""
    t1 = "Metabolismo basal y requerimientos calóricos."
    t2 = "  Metabolismo basal   y requerimientos calóricos. \n"
    assert compute_sha256(t1) == compute_sha256(t2)