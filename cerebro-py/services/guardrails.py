"""
Guardrails de Seguridad Numérica y Dosificación Clínica.
LMS Alquimia - Fase 4: Transformación de Datos para ML.
"""
import re
from typing import Tuple, List, Set
# Patrón regex para capturar cifras asociadas a unidades nutricionales y clínicas
NUMERICAL_DOSAGE_PATTERN = re.compile(
    r'(\b\d+(?:[\.,]\d+)?)\s*(mg|µg|ug|mcg|g|kg|kcal|cal|ml|l|%)\b',
    re.IGNORECASE
)

def extract_numerical_dosages(text: str) -> Set[str]:
    """
    Extrae un conjunto normalizado de magnitudes con su unidad clínica.
    Ejemplo: '15 mg/día y 2.5 g' -> {'15mg', '2.5g'}
    """
    matches = NUMERICAL_DOSAGE_PATTERN.findall(text)
    dosages = set()
    for val, unit in matches:
        # Normalizar coma a punto decimal y microgramos
        norm_val = val.replace(',', '.')
        norm_unit = unit.lower().replace('µg', 'ug').replace('mcg', 'ug')
        dosages.add(f"{norm_val}{norm_unit}")
    return dosages


def validate_numerical_integrity(
    source_text: str, 
    generated_text: str
) -> Tuple[bool, List[str]]:
    """
    Compara las cantidades y unidades clínicas generadas contra el texto fuente.
    Garantiza que toda cifra clínica generada tenga respaldo estricto en el libro.
    
    :param source_text: Fragmento original del libro de texto.
    :param generated_text: Respuesta o pregunta clínica generada.
    :return: Tupla (es_valido, lista_de_errores).
    """
    source_dosages = extract_numerical_dosages(source_text)
    generated_dosages = extract_numerical_dosages(generated_text)
    
    # Si la respuesta generada no menciona ninguna dosis, es numéricamente segura
    if not generated_dosages:
        return True, []
    
    errors: List[str] = []
    
    for dosage in generated_dosages:
        if dosage not in source_dosages:
            errors.append(
                f"Discrepancia de seguridad: la cantidad '{dosage}' generada no está presente en el texto de origen."
            )
            
    is_valid = len(errors) == 0
    return is_valid, errors


