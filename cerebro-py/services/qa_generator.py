"""
Generador de Pares de Instrucción QA en Formato ChatML para Fine-Tuning y Contrastive Learning.
LMS Alquimia - Fase 4: Transformación de Datos para ML.
"""
import re
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


def extract_pedagogical_concept(record: DatasetRecord) -> str:
    """
    Extrae el concepto o tema clínico pedagógico central del texto,
    evitando oraciones huérfanas, verbos conjugados y fragmentos cortados de página.
    """
    content = record.contenido_markdown.lower()
    seccion = record.seccion or ""
    clean_seccion = re.sub(r'^[#*\-\s_\d\.]+', '', seccion).strip()
    # Eliminar puntos suspensivos o números residuales de índices editoriales (ej. "Fosforilación oxidativa...... 42")
    clean_seccion = re.sub(r'[\.\s\-_0-9]+$', '', clean_seccion).strip()

    continuation_starters = (
        "es un", "son los", "desempeñan", "consiste", "que consiste", "de los", "de las",
        "en el", "en la", "para que", "por lo tanto", "así como", "y las", "y los", "con los"
    )
    is_continuation = any(clean_seccion.lower().startswith(s) for s in continuation_starters)
    
    # Si la sección es un título legítimo, formal y conciso
    if clean_seccion and len(clean_seccion) <= 60 and not is_continuation and not clean_seccion.endswith('.'):
        return clean_seccion

    # Inferencia semántica según entidades y patrones clínicos del temario
    if "alimentación" in content and "nutrición" in content and ("voluntario" in content or "involuntario" in content):
        return "la diferenciación entre alimentación y nutrición"
    
    if "factores" in content and ("psicosocial" in content or "social" in content or "económic" in content or "cultural" in content):
        return "los factores psicosociales y económicos determinantes de la alimentación"
        
    if "dietista" in content and ("función" in content or "atención" in content or "método" in content or "profesional" in content):
        return "el rol profesional y el método de atención nutricional del dietista"
        
    if "código alimentario" in content or "definición de nutriente" in content or "nutriente:" in content:
        return "el concepto de nutriente y su clasificación según el Código Alimentario"
        
    if "definición de alimento" in content or "alimento:" in content or "sustancia o producto" in content:
        return "el concepto técnico y normativo de alimento"
        
    if "tasa metabólica basal" in content or "gasto energético" in content or "metabolismo basal" in content:
        return "el gasto energético total y la tasa metabólica basal"

    if "micronutriente" in content or "vitamina" in content or "mineral" in content:
        if record.metadata.nutrientes:
            return f"las funciones y requerimientos de {', '.join(record.metadata.nutrientes)}"
        return "las funciones fisiológicas y fuentes de los micronutrientes"

    if "macronutriente" in content or any(k in content for k in ["glúcido", "hidrato", "proteína", "lípido"]):
        if record.metadata.nutrientes:
            return f"el aporte energético y metabolismo de {', '.join(record.metadata.nutrientes)}"
        return "el metabolismo y balance energético de los macronutrientes"

    if "agua" in content and ("hídrico" in content or "hidratación" in content or "homeostasis" in content):
        return "el balance hídrico y las recomendaciones de hidratación"

    if "anamnesis" in content or "historia clínica" in content:
        return "la anamnesis clínica y dietética en la valoración nutricional"

    if "antropometr" in content or "composición corporal" in content or "imc" in content:
        return "la evaluación antropométrica y estimación de la composición corporal"

    if "bioquímic" in content or "analítica" in content:
        return "la valoración bioquímica del estado nutricional"

    if clean_seccion and not is_continuation and not clean_seccion.startswith(f"{record.documento_origen}"):
        return clean_seccion

    asig = record.asignatura.replace("-", " ").title()
    return f"{asig} (Unidad Didáctica {record.pagina_inicio})"


def formulate_pedagogical_question(record: DatasetRecord, concept: str) -> str:
    """
    Genera preguntas de examen y razonamiento clínico explicativas y variadas,
    adecuadas a la formación profesional en dietética y nutrición.
    """
    content = record.contenido_markdown.lower()
    c_lower = concept.lower()

    # 1. Comparaciones conceptuales (Alimentación vs Nutrición)
    if "diferenciación" in c_lower or ("alimentación" in content and "nutrición" in content and "voluntario" in content):
        return "¿En qué se diferencian los procesos de alimentación y nutrición desde el punto de vista de la voluntariedad, consciencia y su carácter educable?"

    # 2. Factores determinantes biopsicosociales
    if "factores" in c_lower or "psicosocial" in content or "económic" in content:
        return "¿De qué manera influyen los factores psicosociales, culturales y económicos en la elección de alimentos y en la calidad de la dieta según el temario?"

    # 3. Rol del profesional dietista
    if "dietista" in c_lower or "rol profesional" in c_lower:
        return "¿Cuáles son las competencias clave y las fases del método estructurado de atención nutricional que aplica el dietista profesional?"

    # 4. Definiciones técnicas y normativas
    if "concepto de nutriente" in c_lower or "código alimentario" in content:
        return "¿Cómo define la normativa (como el Código Alimentario Español) el concepto de nutriente y qué funciones metabólicas cumple?"

    if "concepto técnico y normativo de alimento" in c_lower:
        return "¿Cuál es la definición legal y técnica de alimento y qué criterios determinan su destino o aptitud para el consumo?"

    # 5. Hidratación y balance hídrico
    if "hídrico" in c_lower or ("agua" in content and "balance" in content):
        return "¿Por qué es fundamental el agua en la homeostasis metabólica y qué pautas de balance hídrico deben considerarse en la práctica dietética?"

    # 6. Micronutrientes y vitaminas
    if "micronutriente" in c_lower or "vitamina" in content or "mineral" in content:
        nutris = f" ({', '.join(record.metadata.nutrientes)})" if record.metadata.nutrientes else ""
        return f"¿Cuáles son las funciones fisiológicas clave, las fuentes alimentarias y los riesgos por déficit o exceso de {concept}{nutris}?"

    # 7. Macronutrientes y metabolismo
    if "macronutriente" in c_lower or any(k in content for k in ["glúcido", "lípido", "proteína", "hidrato"]):
        return f"¿Qué papel metabólico y relevancia energética tienen {concept} y cuáles son sus pautas de ingesta recomendadas?"

    # 8. Si es un título de sección formal específico (ej. "Manejo Nutricional de la Nefropatía")
    if record.seccion and not record.seccion.startswith(f"{record.documento_origen}") and len(record.seccion) <= 65:
        return f"¿Cuáles son las consideraciones clínicas, fisiopatológicas y nutricionales clave sobre {concept} según el temario?"

    # Fallback general explicativo
    return f"¿Qué fundamentos fisiológicos y consideraciones dietéticas clave deben analizarse respecto a {concept} según el temario oficial?"


def synthesize_clinical_qa(record: DatasetRecord) -> Dict[str, str]:
    """
    Sintetiza una pregunta pedagógica explicativa y una respuesta estructurada
    con la voz del Profesor Alquimia a partir de un micro-chunk hijo.
    
    :param record: DatasetRecord correspondiente al micro-chunk hijo.
    :return: Diccionario con 'question' y 'answer'.
    """
    content = record.contenido_markdown.strip()
    
    # 1. Extraer concepto pedagógico limpio y concreto
    concept = extract_pedagogical_concept(record)
    
    # 2. Formulación de la pregunta pedagógica explicativa
    question = formulate_pedagogical_question(record, concept)
    
    # 3. Construcción de la respuesta del Profesor Alquimia
    body = content
    if "\n\n" in content and content.startswith("[Contexto:"):
        body = content.split("\n\n", 1)[1].strip()
        
    gema = (
        f"\n\n💎 **Gema de Sabiduría Alquimia:** En la práctica dietética, dominar los fundamentos de "
        f"*{concept}* es esencial para formular planes nutricionales seguros y adaptados a cada paciente."
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