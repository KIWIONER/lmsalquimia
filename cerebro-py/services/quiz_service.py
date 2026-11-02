import re
import random
import httpx
from typing import List, Dict, Any, Optional
from schemas.quiz import QuizQuestion, QuizGenerationRequest, QuizGenerationResponse
from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

HEADERS = {
    "apikey": SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    "Accept-Profile": "nutricionista"
}

def clean_markdown_text(text: str) -> str:
    """Elimina etiquetas HTML y artefactos markdown para extraer texto puro."""
    if not text:
        return ""
    cleaned = re.sub(r'```[\s\S]*?```', '', text)
    cleaned = re.sub(r'<[^>]+>', '', cleaned)
    cleaned = re.sub(r'[*#_`~>\[\]()|]', ' ', cleaned)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned

async def fetch_cards_for_topics(topics: List[str], limit: int = 25) -> List[Dict[str, Any]]:
    """Consulta las tarjetas reales en Supabase vinculadas a los temas seleccionados."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # 1. Obtener documentos que coincidan con los temas
            docs_res = await client.get(
                f"{SUPABASE_URL}/rest/v1/documentos?select=id,nombre,carpeta&limit=50",
                headers=HEADERS
            )
            if docs_res.status_code != 200:
                return []
            
            all_docs = docs_res.json()
            matched_doc_ids = []
            
            if topics:
                for doc in all_docs:
                    doc_nombre = doc.get("nombre", "").lower()
                    doc_carpeta = doc.get("carpeta", "").lower()
                    for t in topics:
                        t_clean = t.lower().replace("-", " ")
                        if t_clean in doc_nombre or t_clean in doc_carpeta or doc.get("id") == t:
                            matched_doc_ids.append(doc.get("id"))
            
            # Si no hubo match específico, usar los primeros documentos disponibles
            if not matched_doc_ids:
                matched_doc_ids = [d.get("id") for d in all_docs if not d.get("nombre", "").startswith(".empty")][:10]

            if not matched_doc_ids:
                return []

            # 2. Consultar tarjetas de esos documentos
            ids_filter = f"in.({','.join(matched_doc_ids)})"
            cards_res = await client.get(
                f"{SUPABASE_URL}/rest/v1/tarjetas?documento_id={ids_filter}&select=id,titulo,contenido,orden&order=orden.asc&limit={limit}",
                headers=HEADERS
            )
            if cards_res.status_code == 200:
                return cards_res.json()
            return []
    except Exception as e:
        print(f"Error fetching cards from Supabase: {e}")
        return []

def extract_key_concepts_and_facts(card: Dict[str, Any]) -> Dict[str, Any]:
    """Extrae hechos y conceptos de una tarjeta para construir preguntas contextuales."""
    title = card.get("titulo", "").strip()
    raw_content = card.get("contenido", "").strip()
    clean_content = clean_markdown_text(raw_content)

    sentences = [s.strip() for s in re.split(r'[.!?]+', clean_content) if len(s.strip()) > 35]
    
    return {
        "title": title,
        "sentences": sentences[:8],
        "content_sample": clean_content[:600]
    }

def synthesize_clinical_question(
    fact: Dict[str, Any], 
    q_index: int, 
    difficulty: int,
    mode: str,
    topic_label: str
) -> QuizQuestion:
    """Construye una pregunta de opción múltiple con rigor clínico y pedagógico."""
    title = fact["title"]
    sentences = fact["sentences"]
    primary_sentence = sentences[0] if sentences else f"En el estudio de {title}, se deben analizar los procesos bioquímicos y dietéticos fundamentales."

    # Plantillas de preguntas clínicas según dificultad
    if difficulty >= 7:
        question_templates = [
            f"En el contexto clínico avanzado de «{title}», ¿cuál es el mecanismo fisiológico y dietoterapéutico prioritario?",
            f"Respecto a los principios nutricionales analizados en «{title}», ¿qué criterio diagnóstico o pauta de intervención tiene mayor sustento?",
            f"Ante un paciente con requerimientos específicos en la unidad «{title}», ¿cuál es la pauta basada en la evidencia?"
        ]
    else:
        question_templates = [
            f"Según los contenidos de la unidad «{title}», ¿cuál de las siguientes afirmaciones describe con mayor precisión este concepto?",
            f"En la práctica dietética habitual, ¿cuál es el rol fundamental de: «{title}»?",
            f"Al planificar una intervención nutricional sobre «{title}», ¿qué aspecto clave debe considerarse prioritariamente?"
        ]

    question_text = random.choice(question_templates)

    # Respuesta correcta extraída directamente del contenido real
    if len(sentences) >= 2:
        correct_explanation = f"{sentences[0]}. {sentences[1]}."
    elif len(sentences) == 1:
        correct_explanation = f"{sentences[0]}, asegurando la homeostasis metabólica adecuada."
    else:
        correct_explanation = f"Regula las funciones metabólicas celulares y el balance de nutrientes característico de {title}."

    if len(correct_explanation) > 170:
        correct_explanation = correct_explanation[:167] + "..."

    # Generación de distractores plausibles pero clínicamente incorrectos
    distractor_pool = [
        f"Inhibir la absorción luminal completa sin requerir regulación enzimática en {title}.",
        f"Restringir de forma no selectiva el aporte basal independientemente del balance nitrogenado.",
        f"Sustituir los sustratos metabólicos primarios por soluciones hidrosolubles de baja osmolaridad.",
        f"Priorizar la depleción de reservas endógenas antes de iniciar la intervención dietética.",
        f"Limitar el consumo hídrico y osmótico por debajo de los valores basales recomendados.",
        f"Prescribir una pauta rígida sin considerar la variabilidad individual ni los marcadores bioquímicos de {title}."
    ]
    random.shuffle(distractor_pool)
    distractors = distractor_pool[:3]

    # Mezclar y asignar posición aleatoria (0..3)
    options = [correct_explanation] + distractors
    correct_answer_index = random.randint(0, 3)
    
    # Swap
    options[0], options[correct_answer_index] = options[correct_answer_index], options[0]

    rationale = (
        f"Fundamento Clínico: De acuerdo con los contenidos oficiales de «{title}», la opción correcta se basa en que "
        f"{correct_explanation.lower()} Los distractores representan errores comunes de prescripción o asunciones metabólicas desfasadas."
    )

    hint = (
        f"Pista Pedagógica: Recuerda el impacto metabólico central de «{title}» y busca la opción que "
        f"respete la fisiología y la evidencia nutricional sin caer en restricciones extremas."
    )

    return QuizQuestion(
        id=f"py-q-{q_index + 1}-{random.randint(1000, 9999)}",
        text=question_text,
        options=options,
        correctAnswer=correct_answer_index,
        rationale=rationale,
        hint=hint
    )

async def generate_adaptive_quiz(req: QuizGenerationRequest) -> QuizGenerationResponse:
    """Punto de entrada principal: genera el cuestionario adaptativo con preguntas reales."""
    cards = await fetch_cards_for_topics(req.topics, limit=max(req.numQuestions * 2, 20))
    
    facts = []
    if cards:
        for c in cards:
            extracted = extract_key_concepts_and_facts(c)
            if extracted["title"] and len(extracted["sentences"]) > 0:
                facts.append(extracted)

    # Si no se encontraron tarjetas específicas en la DB, usar base curricular de respaldo
    if not facts:
        facts = [
            {"title": "Gasto Energético Basal (GEB) y Total (GET)", "sentences": ["El gasto energético basal representa la energía mínima para mantener las funciones vitales en reposo", "Factores como la masa libre de grasa, edad y sexo determinan la tasa metabólica"]},
            {"title": "Macronutrientes: Proteínas y Balance Nitrogenado", "sentences": ["Las proteínas aportan aminoácidos esenciales necesarios para la síntesis de tejidos y enzimas", "El balance nitrogenado evalúa el equilibrio entre la ingesta y la excreción proteica"]},
            {"title": "Hidratos de Carbono e Índice Glucémico", "sentences": ["Los carbohidratos complejos modulan la respuesta insulínica y la absorción sostenida de glucosa", "La fibra dietética soluble ejerce un efecto prebiótico y regulador del perfil lipídico"]},
            {"title": "Lípidos y Ácidos Grasos Esenciales", "sentences": ["Los ácidos grasos poliinsaturados omega-3 y omega-6 son precursores de eicosanoides antiinflamatorios", "El perfil lipídico plasmático se optimiza reduciendo grasas trans e hidrogenadas"]},
            {"title": "Micronutrientes, Vitaminas y Minerales", "sentences": ["Las vitaminas hidrosolubles del complejo B actúan como coenzimas del metabolismo intermediario", "El calcio, hierro y magnesio son cofactores indispensables en la mineralización y transporte de oxígeno"]}
        ]

    topic_label = ", ".join([t.split('/')[-1].replace('-', ' ').title() for t in req.topics]) if req.topics else "Nutrición y Dietética"

    questions: List[QuizQuestion] = []
    for i in range(req.numQuestions):
        fact = facts[i % len(facts)]
        q = synthesize_clinical_question(
            fact=fact,
            q_index=i,
            difficulty=req.difficulty,
            mode=req.mode,
            topic_label=topic_label
        )
        questions.append(q)

    return QuizGenerationResponse(
        success=True,
        count=len(questions),
        questions=questions,
        source="cerebro_py_clinical_engine"
    )
