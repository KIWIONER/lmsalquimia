"""
Tests Unitarios para el Módulo de Chunking Jerárquico, Guardrails y Generador QA.
LMS Alquimia - Fase 4: Transformación de Datos para ML.
"""
import pytest
from schemas.dataset import DatasetRecord, ClinicalMetadata
from services.chunker import create_hierarchical_chunks, split_into_subblocks
from services.guardrails import validate_numerical_integrity, extract_numerical_dosages
from services.qa_generator import generate_instruction_pairs, PROFESOR_ALQUIMIA_SYSTEM_PROMPT

@pytest.fixture
def sample_parent_record() -> DatasetRecord:
    """Fixture de un registro representativo para chunking jerárquico."""
    markdown_content = (
        "En la intervención dietética de la nefropatía diabética, el control del aporte proteico "
        "es el pilar fundamental para retrasar la progresión del daño renal crónico.\n\n"
        "Se recomienda una pauta estándar de 0.8 g/kg/día en fases no dialíticas, asegurando "
        "al menos un 50% de proteínas de alto valor biológico para evitar desnutrición proteica.\n\n"
        "Respecto al balance hídrico, se aconseja una ingesta basal de 1500 ml/día, ajustando "
        "según diuresis residual y presencia de edemas periféricos."
    )
    return DatasetRecord(
        id="dietoterapia_u2_p015_001",
        parent_id=None,
        asignatura="dietoterapia",
        documento_origen="unidad2_renal.pdf",
        seccion="2.3 Manejo Nutricional de la Nefropatía",
        pagina_inicio=15,
        pagina_fin=16,
        idioma_origen="gl",
        idioma_procesado="es",
        contenido_markdown=markdown_content,
        tipo_contenido="texto",
        metadata=ClinicalMetadata(
            nutrientes=["proteina", "agua"],
            poblacion="renal",
            num_palabras=len(markdown_content.split()),
            contiene_tablas=False,
            content_sha256="d" * 64
        )
    )


def test_split_into_subblocks_respects_paragraphs():
    """Valida la partición de párrafos respetando el umbral de palabras."""
    sample_text = (
        "Párrafo 1 con contenido clínico y fundamentos fisiopatológicos.\n\n"
        "Párrafo 2 con más detalle nutricional y micronutrientes esenciales.\n\n"
        "Párrafo 3 de cierre de la lección y consideraciones dietéticas."
    )
    # Con umbral bajo de 6 palabras, debe partir en múltiples bloques
    blocks = split_into_subblocks(sample_text, max_words=6)
    assert len(blocks) >= 2
    assert "Párrafo 1" in blocks[0]


def test_hierarchical_chunking_parent_and_children(sample_parent_record: DatasetRecord):
    """Valida que los macro-chunks padres y micro-chunks hijos mantengan linaje y contexto."""
    parents, children = create_hierarchical_chunks([sample_parent_record])
    
    # 1. Validación del Padre
    assert len(parents) == 1
    parent = parents[0]
    assert parent.parent_id is None
    assert parent.id.endswith("_padre")
    
    # 2. Validación de los Hijos
    assert len(children) >= 1
    for child in children:
        # Vínculo estricto con el padre
        assert child.parent_id == parent.id
        assert child.id.startswith(parent.id)
        # Inyección del encabezado de linaje contextual
        assert child.contenido_markdown.startswith("[Contexto: Dietoterapia > 2.3 Manejo Nutricional de la Nefropatía]")
        # Hash criptográfico de 64 caracteres
        assert len(child.metadata.content_sha256) == 64
        assert child.metadata.num_palabras == len(child.contenido_markdown.split())

def test_numerical_guardrails_clinical_accuracy():
    """Comprueba que los guardrails detecten alucinaciones y alteraciones de dosis/unidades."""
    source_text = "Se prescribe un suplemento de 15 mg de zinc y 1000 mg de calcio con 20% de lípidos."
    
    # 1. Caso correcto idéntico
    valid_text = "La pauta incluye 15 mg de zinc, 1000 mg de calcio y lípidos al 20%."
    is_valid, errs = validate_numerical_integrity(source_text, valid_text)
    assert is_valid is True
    assert len(errs) == 0
    
    # 2. Caso con dosis alterada (alucinación de 50 mg de zinc)
    hallucinated_text = "La pauta incluye 50 mg de zinc."
    is_valid_bad, errs_bad = validate_numerical_integrity(source_text, hallucinated_text)
    assert is_valid_bad is False
    assert any("50mg" in e for e in errs_bad)
    
    # 3. Caso con cambio de unidad peligrosa (15 g en vez de 15 mg)
    unit_error_text = "La pauta incluye 15 g de zinc."
    is_valid_unit, errs_unit = validate_numerical_integrity(source_text, unit_error_text)
    assert is_valid_unit is False
    assert any("15g" in e for e in errs_unit)


def test_qa_generator_chatml_structure(sample_parent_record: DatasetRecord):
    """Valida que el generador produzca ejemplos ChatML con la personalidad del Profesor Alquimia."""
    _, children = create_hierarchical_chunks([sample_parent_record])
    chatml_dataset = generate_instruction_pairs(children)
    
    assert len(chatml_dataset) >= 1
    first_example = chatml_dataset[0]
    
    assert "messages" in first_example
    assert "metadata" in first_example
    
    messages = first_example["messages"]
    assert len(messages) == 3
    
    # Comprobar roles y contenido
    system_msg = messages[0]
    user_msg = messages[1]
    assistant_msg = messages[2]
    
    assert system_msg["role"] == "system"
    assert "Profesor Alquimia" in system_msg["content"]
    
    assert user_msg["role"] == "user"
    assert "Manejo Nutricional de la Nefropatía" in user_msg["content"]
    
    assert assistant_msg["role"] == "assistant"
    assert "💎 **Gema de Sabiduría Alquimia:**" in assistant_msg["content"]
    assert "Hola, futuro dietista" in assistant_msg["content"]
    
    # Metadatos de linaje
    assert first_example["metadata"]["parent_id"] == children[0].parent_id