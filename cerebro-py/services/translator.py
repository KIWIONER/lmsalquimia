"""
Módulo de Normalización Lingüística y Glosario Clínico Gallego -> Castellano.
LMS Alquimia - Fase 3: Motor Neuronal Local 100% Offline (Helsinki-NLP/opus-mt-gl-es).
"""

import re
import hashlib
from typing import Dict, List, Optional
from schemas.dataset import DatasetRecord, ClinicalMetadata

# Variables globales para modelo neural local
_marian_tokenizer = None
_marian_model = None
_MODEL_NAME = "Helsinki-NLP/opus-mt-gl-es"


def get_local_translator():
    """Carga y cachea en memoria el modelo neural local Helsinki-NLP/opus-mt-gl-es."""
    global _marian_tokenizer, _marian_model
    if _marian_tokenizer is None or _marian_model is None:
        try:
            from transformers import MarianMTModel, MarianTokenizer
            _marian_tokenizer = MarianTokenizer.from_pretrained(_MODEL_NAME)
            _marian_model = MarianMTModel.from_pretrained(_MODEL_NAME)
        except Exception as e:
            print(f"⚠️ Aviso: No se pudo cargar el modelo local ({e}). Usando fallback léxico.")
            _marian_tokenizer = False
            _marian_model = False
    return _marian_tokenizer, _marian_model


# Glosario Clínico y Nutricional Protegido (Gallego -> Castellano)
CLINICAL_GL_ES_MAP: Dict[str, str] = {
    # Macronutrientes y Bioquímica
    "glucidos": "glúcidos",
    "glucido": "glúcido",
    "glícidos": "glúcidos",
    "glícido": "glúcido",
    "hidratos de carbono": "hidratos de carbono",
    "graxas": "grasas",
    "graxa": "grasa",
    "graxos": "grasos",
    "graxo": "graso",
    "auga": "agua",
    "augas": "aguas",
    "glicosa": "glucosa",
    "proteínas": "proteínas",
    "lípidos": "lípidos",
    
    # Fisiología y Nutrición Clínica
    "ingestión de": "ingesta de",
    "Ingestión de": "Ingesta de",
    "ingestión recomendada": "ingesta recomendada",
    "Ingestión recomendada": "Ingesta recomendada",
    "inxesta": "ingesta",
    "inxestas": "ingestas",
    "inxerir": "ingerir",
    "inxerido": "ingerido",
    "inxestión": "ingesta",
    "inxestións": "ingestas",
    "pescuda": "investigación",
    "pescudas": "investigaciones",
    "pescudar": "investigar",
    "rexeitamento": "rechazo",
    "devir": "devenir",
    "crecemento": "crecimiento",
    "envellecemento": "envejecimiento",
    "amplo": "amplio",
    "ampla": "amplia",
    "doenza": "enfermedad",
    "doenzas": "enfermedades",
    "patoloxía": "patología",
    "patoloxías": "patologías",
    "calórico": "calórico",
    "enerxético": "energético",
    "enerxética": "energética",
    "enerxéticos": "energéticos",
    "enerxéticas": "energéticas",
    "saúde": "salud",
    "persoas": "personas",
    "persoa": "persona",
    "calidade": "calidad",
    "cantidade": "cantidad",
    "plans": "planes",
    "coñecementos": "conocimientos",
    "coñecemento": "conocimiento",
    
    # Verbos y preposiciones
    "é": "es",
    "son": "son",
    "manter": "mantener",
    "previr": "prevenir",
    "avaliar": "evaluar",
    "deseñar": "diseñar",
    "obter": "obtener",
    "conter": "contener",
    "constitúe": "constituye",
    "polo seu": "por su",
    "pola súa": "por su",
    "polos seus": "por sus",
    "polas súas": "por sus",
    "seu": "su",
    "súa": "su",
    "seus": "sus",
    "súas": "sus",
    "polo que": "por lo que",
    "pola que": "por la que",
    "polo tanto": "por lo tanto",
    "polo": "por el",
    "pola": "por la",
    "polos": "por los",
    "polas": "por las",
    "tamén": "también",
    "ademais": "además",
    "aínda": "aún",
    "ás": "a las",
    "ao": "al",
    "aos": "a los",
    "ós": "a los",
    "ó": "al",
    "á": "a la",
    "nas": "en las",
    "nos": "en los",
    "na": "en la",
    "no": "en el",
    "nun": "en un",
    "nunha": "en una",
    "dun": "de un",
    "dunha": "de una",
    "dunhas": "de unas",
    "duns": "de unos",
    "dos": "de los",
    "das": "de las",
    "do": "del",
    "da": "de la",
    "destes": "de estos",
    "destas": "de estas",
    "deste": "de este",
    "desta": "de esta",
    "estes": "estos",
    "estas": "estas",
    "xa que": "ya que",
    "ou": "o",
    "e": "y",
    "orixe": "origen",
    "ollo": "ojo",
    "fígado": "hígado",
    "ril": "riñón",
    "rins": "riñones",
    "ósos": "huesos",
    "óso": "hueso",
    "sangue": "sangre",
    "leite": "leche"
}


def apply_clinical_glossary(text: str) -> str:
    """
    Sustituye la terminología gallega por su equivalente exacto en castellano
    respetando límites de palabra y manteniendo mayúsculas iniciales.
    """
    if not text:
        return ""
    
    normalized = text
    sorted_terms = sorted(CLINICAL_GL_ES_MAP.keys(), key=len, reverse=True)
    
    for gl_term in sorted_terms:
        es_term = CLINICAL_GL_ES_MAP[gl_term]
        pattern_lower = rf'\b{re.escape(gl_term)}\b'
        normalized = re.sub(pattern_lower, es_term, normalized)
        
        gl_cap = gl_term.capitalize()
        es_cap = es_term.capitalize()
        pattern_cap = rf'\b{re.escape(gl_cap)}\b'
        normalized = re.sub(pattern_cap, es_cap, normalized)
        
        gl_upper = gl_term.upper()
        es_upper = es_term.upper()
        pattern_upper = rf'\b{re.escape(gl_upper)}\b'
        normalized = re.sub(pattern_upper, es_upper, normalized)
        
    return normalized


def translate_sentence_segment(text: str) -> str:
    """
    Traduce un bloque de texto gallego a castellano utilizando el modelo neural
    local Helsinki-NLP/opus-mt-gl-es (100% offline), garantizando cero rate-limits.
    """
    if not text or not text.strip():
        return text

    clean = text.strip()
    tok, mod = get_local_translator()

    if tok and mod:
        try:
            # Dividir en oraciones si el bloque es extenso
            sentences = [s.strip() for s in re.split(r"(?<=[.!?\n])\s+", clean) if s.strip()]
            if not sentences:
                sentences = [clean]
                
            inputs = tok(sentences, return_tensors="pt", padding=True, truncation=True, max_length=512)
            outputs = mod.generate(**inputs, max_length=512)
            translated_sentences = [tok.decode(t, skip_special_tokens=True) for t in outputs]
            
            full_translated = " ".join(translated_sentences)
            return apply_clinical_glossary(full_translated)
        except Exception as e:
            print(f"Aviso neural: {e}. Usando glosario.")

    return apply_clinical_glossary(clean)


def translate_gl_to_es(text_markdown: str) -> str:
    """
    Normaliza un bloque de Markdown de Gallego a Castellano respetando
    tablas, listas, encabezados y ecuaciones.
    """
    if not text_markdown:
        return ""
    
    lines = text_markdown.split('\n')
    translated_lines = []
    
    for line in lines:
        stripped = line.strip()
        
        # 1. Separador de tabla Markdown (| --- | --- |)
        if re.match(r"^\|(\s*:?-+:?\s*\|)+$", stripped):
            translated_lines.append(line)
            continue
            
        # 2. Fila de tabla Markdown (| Col 1 | Col 2 |)
        if stripped.startswith("|") and stripped.endswith("|"):
            cells = [c.strip() for c in stripped.split("|")[1:-1]]
            translated_cells = [apply_clinical_glossary(c) for c in cells]
            translated_line = "| " + " | ".join(translated_cells) + " |"
            translated_lines.append(translated_line)
            continue
            
        # 3. Encabezados Markdown (## Título)
        if stripped.startswith("#"):
            prefix_match = re.match(r"^(#+)\s*(.*)", line)
            if prefix_match:
                hashes, title = prefix_match.groups()
                translated_lines.append(f"{hashes} {translate_sentence_segment(title)}")
                continue
                
        # 4. Líneas de texto normal o párrafos
        translated_lines.append(translate_sentence_segment(line))
        
    return '\n'.join(translated_lines)


def compute_sha256(text: str) -> str:
    """Calcula el hash SHA-256 de 64 caracteres de un texto normalizado."""
    normalized = re.sub(r'\s+', ' ', text.strip()).encode('utf-8')
    return hashlib.sha256(normalized).hexdigest()


def normalize_records_to_spanish(records: List[DatasetRecord]) -> List[DatasetRecord]:
    """
    Transforma una lista de DatasetRecord en gallego hacia castellano normalizado,
    recalculando sus hashes SHA-256 y actualizando metadatos clínicos.
    """
    translated_records: List[DatasetRecord] = []
    
    for rec in records:
        es_content = translate_gl_to_es(rec.contenido_markdown)
        es_section = translate_gl_to_es(rec.seccion)
        
        new_word_count = len(es_content.split())
        new_sha256 = compute_sha256(es_content)
        
        new_metadata = ClinicalMetadata(
            nutrientes=rec.metadata.nutrientes,
            poblacion=rec.metadata.poblacion,
            num_palabras=new_word_count,
            contiene_tablas=rec.metadata.contiene_tablas,
            content_sha256=new_sha256
        )
        
        es_record = DatasetRecord(
            id=rec.id,
            parent_id=rec.parent_id,
            asignatura=rec.asignatura,
            documento_origen=rec.documento_origen,
            seccion=es_section,
            pagina_inicio=rec.pagina_inicio,
            pagina_fin=rec.pagina_fin,
            idioma_origen="gl",
            idioma_procesado="es",
            contenido_markdown=es_content,
            tipo_contenido=rec.tipo_contenido,
            metadata=new_metadata
        )
        translated_records.append(es_record)
        
    return translated_records
