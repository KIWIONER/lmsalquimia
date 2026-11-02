"""
Módulo de Limpieza Geométrica y Normalización Textual de PDFs.
LMS Alquimia - Fase 2: Extracción y Limpieza de Ruido Editorial.
"""
import re
import pymupdf

def clean_hyphenation_and_newlines(raw_text: str) -> str:
    """
    Reconstruye palabras partidas por guion al final de línea (de-hyphenation)
    y normaliza los saltos de línea sin romper párrafos legítimos ni listas.
    
    Ejemplos:
      - 'me-\\ntabolismo' -> 'metabolismo'
      - 'omega-3' -> 'omega-3' (se preserva)
    """
    if not raw_text:
        return ""
    
    # 1. Unir palabras separadas por guion al final de línea:
    # Coincide con letra + guion + salto de línea + espacios opcionales + letra
    text = re.sub(r'([a-zA-ZáéíóúÁÉÍÓÚñÑüÜ])-\s*\n\s*([a-zA-ZáéíóúÁÉÍÓÚñÑüÜ])', r'\1\2', raw_text)
    
    # 2. Reemplazar saltos de línea simples dentro de un mismo párrafo por espacios,
    # preservando párrafos dobles (\n\n), listas (- o * o 1.) y encabezados (#)
    lines = text.split('\n')
    processed_lines = []
    
    for i, line in enumerate(lines):
        stripped = line.strip()
        # Si la línea está vacía, es encabezado o viñeta de lista, se respeta tal cual
        if (
            not stripped 
            or stripped.startswith(('#', '-', '*', '>', '|')) 
            or re.match(r'^\d+[\.\)]\s+', stripped)
        ):
            processed_lines.append(stripped)
        else:
            # Si la línea anterior era de texto continuo, unir con espacio
            if processed_lines and processed_lines[-1] and not processed_lines[-1].startswith(('#', '-', '*', '>', '|')):
                processed_lines[-1] = f"{processed_lines[-1]} {stripped}"
            else:
                processed_lines.append(stripped)
                
    result = '\n'.join(processed_lines)
    # Limpiar espacios horizontales múltiples
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