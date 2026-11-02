"""
Módulo de Limpieza Geométrica y Normalización Textual de PDFs.
LMS Alquimia - Fase 2: Extracción y Limpieza de Ruido Editorial.
"""
import re
import pymupdf

def clean_unicode_artifacts(text: str) -> str:
    """
    Normaliza caracteres tipográficos especiales de PDFs que rompen la tokenización:
    - Comillas tipográficas (“ ”, « », „ “) -> comillas estándar "
    - Comillas simples tipográficas (‘ ’, ‚ ‘) -> '
    - Guiones largos, guiones medios y signos menos (—, –, −) -> -
    - Símbolos decorativos o fuentes extraídas como notas/mojibake (♫, ï, etc.)
    - Espacios duros (\u00a0, \u202f), zero-width spaces (\u200b), soft hyphens (\xad)
    """
    if not text:
        return ""
    # Espacios especiales y caracteres invisibles
    text = text.replace('\u00a0', ' ').replace('\u202f', ' ').replace('\u200b', '').replace('\xad', '')
    
    # Comillas tipográficas a estándar
    text = re.sub(r'[“”„«»]', '"', text)
    text = re.sub(r'[‘’‚‹›]', "'", text)
    
    # Guiones y signos menos
    text = re.sub(r'[—–−]', '-', text)
    
    # Símbolos residuales de codificación o mojibake
    text = re.sub(r'[♫ï\ufffd\x00-\x08\x0b\x0c\x0e-\x1f]', '', text)
    
    return text


def clean_hyphenation_and_newlines(raw_text: str) -> str:
    """
    Reconstruye palabras partidas por guion al final de línea (de-hyphenation)
    y normaliza los saltos de línea sin romper párrafos legítimos, tablas ni listas.
    
    Ejemplos:
      - 'me-\\ntabolismo' -> 'metabolismo'
      - 'omega-3' -> 'omega-3' (se preserva)
    """
    if not raw_text:
        return ""
    
    # 0. Limpieza tipográfica y de mojibake
    text = clean_unicode_artifacts(raw_text)
    
    # 1. Unir palabras separadas por guion al final de línea:
    text = re.sub(r'([a-zA-ZáéíóúÁÉÍÓÚñÑüÜ])-\s*\n\s*([a-zA-ZáéíóúÁÉÍÓÚñÑüÜ])', r'\1\2', text)
    
    # 2. Reemplazar saltos de línea dentro de párrafos continuos pero respetando
    # listas cortas, encabezados y oraciones que terminan en punto o dos puntos.
    lines = text.split('\n')
    processed_lines = []
    
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
            
        # Elementos estructurales que nunca se deben concatenar
        is_structural = (
            stripped.startswith(('#', '-', '*', '>', '|', '•'))
            or bool(re.match(r'^\d+[\.\)]\s+', stripped))
            or (stripped.isupper() and len(stripped) <= 40)
            or bool(re.match(r'^Vitamina\s+[A-Z0-9]+', stripped, re.IGNORECASE))
        )
        
        if is_structural:
            processed_lines.append(stripped)
        else:
            if processed_lines:
                prev = processed_lines[-1]
                # Si la línea anterior era estructural o terminaba en signo de puntuación fuerte (. : ? !)
                # mantenerla como línea independiente para no crear frases gigantes sin sentido.
                prev_ends_sentence = prev.endswith(('.', ':', '?', '!'))
                prev_is_structural = (
                    prev.startswith(('#', '-', '*', '>', '|', '•'))
                    or bool(re.match(r'^\d+[\.\)]\s+', prev))
                    or (prev.isupper() and len(prev) <= 40)
                    or bool(re.match(r'^Vitamina\s+[A-Z0-9]+', prev, re.IGNORECASE))
                )
                
                if prev_ends_sentence or prev_is_structural:
                    processed_lines.append(stripped)
                else:
                    processed_lines[-1] = f"{prev} {stripped}"
            else:
                processed_lines.append(stripped)
                
    result = '\n'.join(processed_lines)
    result = re.sub(r'[ \t]+', ' ', result)
    return result.strip()


def crop_page_margins(page: pymupdf.Page, top_margin_pct: float = 0.08, bottom_margin_pct: float = 0.08) -> str:
    """
    Extrae el texto de la página descartando los márgenes superior e inferior
    para eliminar cabeceras editoriales y números de página huérfanos.
    
    :param page: Objeto Page de PyMuPDF.
    :param top_margin_pct: Porcentaje superior a ignorar (default: 8%).
    :param bottom_margin_pct: Porcentaje inferior a ignorar (default: 8%).
    :return: Texto extraído del área útil (rectángulo central).
    """
    rect = page.rect
    total_height = rect.height
    
    # Calcular coordenadas del rectángulo útil (área de lectura)
    y0 = rect.y0 + (total_height * top_margin_pct)
    y1 = rect.y1 - (total_height * bottom_margin_pct)
    
    reading_box = pymupdf.Rect(rect.x0, y0, rect.x1, y1)
    
    # Extraer texto restringido únicamente a ese rectángulo geométrico
    cropped_text = page.get_text("text", clip=reading_box)
    return clean_hyphenation_and_newlines(cropped_text)


def is_non_pedagogical_page(page_text: str) -> bool:
    """
    Evalúa heurísticamente si una página es ruido editorial o preliminar
    (portada, créditos de copyright, ISBN, depósito legal o índice general).
    
    :param page_text: Texto extraído de la página.
    :return: True si la página debe ser descartada; False si contiene materia lectiva.
    """
    if not page_text or len(page_text.strip()) < 40:
        return True
    
    text_lower = page_text.lower()
    
    # 1. Patrones claros de páginas legales y de derechos
    legal_indicators = [
        "isbn",
        "depósito legal",
        "deposito legal",
        "todos os dereitos reservados",
        "todos los derechos reservados",
        "copyright",
        "impreso en",
        "impreso en españa",
        "tirada:",
        "edición:"
    ]
    legal_matches = sum(1 for ind in legal_indicators if ind in text_lower)
    if legal_matches >= 2:
        return True
        
    # 2. Patrones de índices o tablas de contenido extensas
    # Líneas repetidas con puntos continuos tipo '1.2 Concepto ....... 14'
    dot_leaders = len(re.findall(r'\.{4,}\s*\d+', page_text))
    if dot_leaders >= 4:
        return True
        
    # 3. Páginas con densidad léxica casi nula (portadas institucionales con pocos términos)
    words = page_text.split()
    if len(words) < 25 and ("módulo" in text_lower or "ciclo" in text_lower or "xunta" in text_lower):
        return True
        
    return False