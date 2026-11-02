"""
Suite de Pruebas Unitarias para el Módulo de Normalización Lingüística (Gallego -> Castellano).
LMS Alquimia - Fase 3: Normalización Lingüística.
"""
import pytest
from schemas.dataset import DatasetRecord, ClinicalMetadata
from services.translator import (
    apply_clinical_glossary,
    translate_gl_to_es,
    normalize_records_to_spanish,
    compute_sha256
)

def test_clinical_glossary_replacement():
    """Verifica la traducción de términos clave y respeto a mayúsculas/minúsculas."""
    raw = "A inxesta de graxas e glícidos na auga ten orixe celular."
    normalized = apply_clinical_glossary(raw)
    assert "ingesta" in normalized
    assert "grasas" in normalized
    assert "glúcidos" in normalized
    assert "agua" in normalized
    assert "origen" in normalized
    # Mayúsculas iniciales y totales
    caps = apply_clinical_glossary("GRAXAS e Auga")
    assert "GRASAS" in caps
    assert "Agua" in caps

def test_markdown_table_translation_integrity():
    """Verifica que una tabla Markdown se traduce sin romper columnas ni separadores."""
    raw_table = (
        "## 1.1 Inxesta de lípidos\n"
        "| Nutriente | Inxesta Recomendada | Función |\n"
        "| :--- | :--- | :--- |\n"
        "| Graxas Saturadas | Menos do 10% | Enerxética |\n"
        "| Glícidos Complexos | 50-55% | Regulación |\n"
    )
    translated = translate_gl_to_es(raw_table)
    
    assert "## 1.1 Ingesta de lípidos" in translated
    assert "| Grasas Saturadas |" in translated
    assert "| Glúcidos Complexos |" in translated or "| Glúcidos" in translated
    assert "| :--- | :--- | :--- |" in translated
    
    # Comprobar cuadratura de la tabla resultante
    lines = [l.strip() for l in translated.strip().split("\n") if l.strip().startswith("|")]
    assert len(lines) == 4  # Cabecera, separador, 2 filas de datos
    for row in lines:
        cells = [c.strip() for c in row.split("|")[1:-1]]
        assert len(cells) == 3, f"Fila desalineada: {row}"


def test_normalize_records_to_spanish_reproducibility():
    """Verifica que el adaptador de registros DatasetRecord actualiza hashes y metadatos."""
    sample = DatasetRecord(
        id="test_ae_001",
        parent_id=None,
        asignatura="alimentacion-equilibrada",
        documento_origen="ud1.pdf",
        seccion="1.1 Inxesta de graxas na dieta",
        pagina_inicio=5,
        pagina_fin=5,
        idioma_origen="gl",
        idioma_procesado="es",
        contenido_markdown="A inxesta de graxas saturadas debe limitarse polo seu impacto cardiovascular.",
        tipo_contenido="texto",
        metadata=ClinicalMetadata(
            nutrientes=["lipidos"],
            poblacion="general",
            num_palabras=11,
            contiene_tablas=False,
            content_sha256="0" * 64
        )
    )
    
    translated_records = normalize_records_to_spanish([sample])
    assert len(translated_records) == 1
    
    res = translated_records[0]
    assert res.id == "test_ae_001"
    assert "Ingesta de grasas" in res.seccion
    assert "ingesta de grasas" in res.contenido_markdown
    assert "por su impacto" in res.contenido_markdown
    assert res.metadata.content_sha256 != "0" * 64
    assert res.metadata.content_sha256 == compute_sha256(res.contenido_markdown)