"""
Generador de Pares de Instrucción QA en Formato ChatML para Fine-Tuning y Contrastive Learning.
LMS Alquimia - Fase 4: Transformación de Datos para ML.
"""
from typing import List, Dict, Any
from schemas.dataset import DatasetRecord
from services.guardrails import validate_numerical_integrity
PROFESOR_ALQUIMIA_SYSTEM_PROMPT = (
    "Eres el Profesor Alquimia, el tutor clínico y pedagógico de Nutrición y Dietética "
    "en el LMS Alquimia. Tu labor es responder a los estudiantes de Formación Profesional "
    "con rigor biomédico, tono cercano y claridad didáctica, basándote exclusivamente "
    "en el temario oficial. Siempre concluyes tu explicación con una '💎 Gema de Sabiduría Alquimia' "
    "que resume el concepto clave para la práctica clínica."
)


def synthesize_clinical_qa(record: DatasetRecord) -> Dict[str, str]:
    """
    Sintetiza una pregunta pedagógica y una respuesta estructurada con la voz
    del Profesor Alquimia a partir de un micro-chunk hijo.
    
    :param record: DatasetRecord correspondiente al micro-chunk hijo.
    :return: Diccionario con 'question' y 'answer'.
    """
    content = record.contenido_markdown.strip()
    
    # Extraer el foco clínico temático
    topic = record.seccion if record.seccion else record.asignatura
    nutrientes = record.metadata.nutrientes
    nutriente_tag = f" en relación a {', '.join(nutrientes)}" if nutrientes else ""
    
    # Formulación de la pregunta pedagógica
    question = f"¿Cuáles son las consideraciones clínicas y nutricionales clave sobre {topic}{nutriente_tag} según el temario?"
    
    # Construcción de la respuesta del Profesor Alquimia
    body = content
    # Si viene con encabezado de contexto inyectado, tomar el cuerpo principal
    if "\n\n" in content and content.startswith("[Contexto:"):
        body = content.split("\n\n", 1)[1].strip()
        
    gema = (
        f"\n\n💎 **Gema de Sabiduría Alquimia:** En la práctica dietética, dominar los conceptos de "
        f"*{topic}* es esencial para formular planes nutricionales seguros y adaptados a cada paciente."
    )
    
    answer = f"Hola, futuro dietista. Vamos a analizar este concepto fundamental de tu formación:\n\n{body}{gema}"
    
    return {
        "question": question,
        "answer": answer
    }

def format_chatml_record(record: DatasetRecord, qa: Dict[str, str]) -> Dict[str, Any]:
    """
    Empaqueta el par QA en la estructura canónica ChatML compatible con Hugging Face,
    SFTTrainer, vLLM y OpenAI API.
    
    :param record: DatasetRecord origen del chunk hijo.
    :param qa: Diccionario con 'question' y 'answer'.
    :return: Registro ChatML con mensajes y metadatos de linaje.
    """
    return {
        "messages": [
            {
                "role": "system",
                "content": PROFESOR_ALQUIMIA_SYSTEM_PROMPT
            },
            {
                "role": "user",
                "content": qa["question"]
            },
            {
                "role": "assistant",
                "content": qa["answer"]
            }
        ],
        "metadata": {
            "source_chunk_id": record.id,
            "parent_id": record.parent_id,
            "asignatura": record.asignatura,
            "seccion": record.seccion,
            "content_sha256": record.metadata.content_sha256
        }
    }

def generate_instruction_pairs(records: List[DatasetRecord]) -> List[Dict[str, Any]]:
    """
    Procesa una lista de chunks y genera pares de instrucción supervisados en ChatML,
    validando que la respuesta respete el guardrail de integridad numérica.
    
    :param records: Lista de micro-chunks hijos.
    :return: Lista de ejemplos de entrenamiento en formato ChatML.
    """
    dataset_chatml: List[Dict[str, Any]] = []
    
    for rec in records:
        qa = synthesize_clinical_qa(rec)
        
        # Validar guardrail de integridad numérica entre el chunk y la respuesta sintética
        is_safe, errs = validate_numerical_integrity(rec.contenido_markdown, qa["answer"])
        if not is_safe:
            # En caso de discrepancia de cifras, se descarta para proteger la calidad del Fine-Tuning
            continue
            
        chatml_entry = format_chatml_record(rec, qa)
        dataset_chatml.append(chatml_entry)
        
    return dataset_chatml