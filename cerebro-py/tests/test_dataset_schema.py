"""
Suite de Pruebas Unitarias para el Esquema del Dataset y Validación de Tablas.
LMS Alquimia - Hito 1: Formato de Salida e Intercambio.
"""
import json
import re
import pytest
from pydantic import ValidationError
from schemas.dataset import DatasetRecord, ClinicalMetadata

def parse_markdown_table_columns(markdown_text: str) -> list[int]:
    """
    Función auxiliar de prueba:
    Extrae el número de celdas por fila en todas las tablas Markdown del texto.
    """
    lines = markdown_text.strip().split("\n")
    table_rows = [l.strip() for l in lines if l.strip().startswith("|") and l.strip().endswith("|")]
    
    # Excluir la fila separadora (| --- | --- |)
    data_rows = [r for r in table_rows if not re.match(r"^\|(\s*:?-+:?\s*\|)+$", r)]
    
    # Contar columnas separando por '|' (restando los bordes vacíos)
    counts = []
    for row in data_rows:
        cells = [c.strip() for c in row.split("|")[1:-1]]
        counts.append(len(cells))
    return counts

def test_valid_fixture_loading():
    """Verifica que el fixture sintético sample_dataset.jsonl carga al 100% sin errores."""
    fixture_path = "cerebro-py/tests/fixtures/sample_dataset.jsonl"
    with open(fixture_path, "r", encoding="utf-8") as f:
        lines = [json.loads(line) for line in f if line.strip()]
    assert len(lines) == 3
    records = [DatasetRecord(**data) for data in lines]
    assert len(records) == 3
    assert records[0].tipo_contenido == "texto"
    assert records[1].tipo_contenido == "tabla"
    assert records[2].tipo_contenido == "formula"  

def test_rejection_of_short_text():
    """Verifica que Pydantic rechaza fragmentos con menos de 40 caracteres (ruido de paginado)."""
    with pytest.raises(ValidationError) as exc_info:
        DatasetRecord(
            id="test_err_short",
            asignatura="alimentacion-equilibrada",
            documento_origen="ud1.pdf",
            seccion="Tema Corto",
            pagina_inicio=1,
            pagina_fin=1,
            contenido_markdown="Texto muy corto.",  # < 40 caracteres
            tipo_contenido="texto",
            metadata=ClinicalMetadata(
                num_palabras=3,
                content_sha256="a" * 64
            )
        )
    assert "contenido_markdown" in str(exc_info.value)

def test_rejection_of_invalid_sha256():
    """Verifica que un hash SHA-256 no hexadecimal o de longitud distinta a 64 es rechazado."""
    with pytest.raises(ValidationError) as exc_info:
        DatasetRecord(
            id="test_err_hash",
            asignatura="alimentacion-equilibrada",
            documento_origen="ud1.pdf",
            seccion="Tema Hash",
            pagina_inicio=1,
            pagina_fin=1,
            contenido_markdown="Este es un texto clínico válido con más de cuarenta caracteres obligatorios.",
            tipo_contenido="texto",
            metadata=ClinicalMetadata(
                num_palabras=10,
                content_sha256="hash_invalido_demasiado_corto"  # Inválido
            )
        )
    assert "content_sha256" in str(exc_info.value)

def test_table_squareness_in_fixture():
    """
    Verifica matemáticamente que la tabla del fixture tiene exactamente 
    el mismo número de columnas en la cabecera y en todas las filas de datos.
    """
    fixture_path = "cerebro-py/tests/fixtures/sample_dataset.jsonl"
    with open(fixture_path, "r", encoding="utf-8") as f:
        lines = [json.loads(line) for line in f if line.strip()]
    table_record = next(r for r in lines if r["tipo_contenido"] == "tabla")
    counts = parse_markdown_table_columns(table_record["contenido_markdown"])
    assert len(counts) >= 2, "La tabla debe tener al menos cabecera y una fila"
    header_cols = counts[0]
    assert header_cols == 4, f"La cabecera de la tabla de prueba debe tener 4 columnas, tiene {header_cols}"
    
    # Todas las filas deben coincidir con la cabecera (tabla cuadrada)
    for idx, row_cols in enumerate(counts[1:], start=1):
        assert row_cols == header_cols, f"Fila {idx} tiene {row_cols} columnas, se esperaban {header_cols}"