"""
Guardrails de Seguridad Numérica, Dosificación Clínica y Anti-Inyección.
LMS Alquimia - Fase 2: Ingeniería de IA Observable y Evaluable.
"""
import re
from typing import Tuple, List, Set, Dict, Any

# Patrón regex para capturar cifras asociadas a unidades nutricionales, clínicas y científicas
NUMERICAL_DOSAGE_PATTERN = re.compile(
    r"(\b\d+(?:[\.,]\d+)?)\s*(°\s*[cf]|mg|µg|ug|mcg|g|kg|kcal|cal|ml|l|%|mmol/l|mol/l|mmol|mol|mmhg|pa|ui)\b",
    re.IGNORECASE,
)

PROMPT_INJECTION_PATTERNS = [
    re.compile(r"ignore\s+(all\s+)?(previous|prior)\s+instructions", re.IGNORECASE),
    re.compile(r"ignora\s+(todas\s+)?(las|tus)\s+instrucciones", re.IGNORECASE),
    re.compile(r"reveal\s+(your\s+)?system\s+prompt", re.IGNORECASE),
    re.compile(r"revela\s+(tu\s+)?prompt\s+del\s+sistema", re.IGNORECASE),
    re.compile(r"act\s+as\s+unrestricted|modo\s+sin\s+restricciones|jailbreak", re.IGNORECASE),
]


def detect_prompt_injection(text: str) -> bool:
    """Detecta intentos explícitos de prompt injection en entrada de usuario o contexto."""
    if not text:
        return False
    return any(pattern.search(text) for pattern in PROMPT_INJECTION_PATTERNS)


def extract_numerical_dosages(text: str) -> Set[str]:
    """
    Extrae un conjunto normalizado de magnitudes con su unidad clínica/científica.
    Ejemplo: '15 mg/día y 2.5 g' -> {'15mg', '2.5g'}
    """
    matches = NUMERICAL_DOSAGE_PATTERN.findall(text)
    dosages = set()
    for val, unit in matches:
        norm_val = val.replace(",", ".")
        norm_unit = re.sub(r"\s+", "", unit.lower()).replace("µg", "ug").replace("mcg", "ug")
        dosages.add(f"{norm_val}{norm_unit}")
    return dosages


def validate_bidirectional_numerical_integrity(
    source_text: str,
    generated_text: str,
) -> Dict[str, Any]:
    """
    Valida integridad numérica bidireccional entre el texto literal del PDF y la salida IA:
    - Detecta cifras/unidades inventadas o alteradas (alucinación).
    - Detecta cifras/unidades del PDF que desaparecieron en la salida (omisión silenciosa).
    """
    source_dosages = extract_numerical_dosages(source_text)
    generated_dosages = extract_numerical_dosages(generated_text)

    missing_in_output = sorted(source_dosages - generated_dosages)
    invented_in_output = sorted(generated_dosages - source_dosages)

    errors: List[str] = []
    if missing_in_output:
        errors.append(
            f"Omisión clínica detectada: faltan cantidades del origen ({', '.join(missing_in_output)})."
        )
    if invented_in_output:
        errors.append(
            f"Discrepancia de seguridad: cantidades no respaldadas por el origen ({', '.join(invented_in_output)})."
        )

    return {
        "ok": len(missing_in_output) == 0 and len(invented_in_output) == 0,
        "missing_in_output": missing_in_output,
        "invented_in_output": invented_in_output,
        "source_dosages": sorted(source_dosages),
        "generated_dosages": sorted(generated_dosages),
        "errors": errors,
    }


def validate_numerical_integrity(
    source_text: str,
    generated_text: str,
) -> Tuple[bool, List[str]]:
    """
    Compara las cantidades y unidades clínicas generadas en TODO el mensaje completo
    contra el texto fuente. Garantiza que toda cifra clínica tenga respaldo estricto.
    """
    source_dosages = extract_numerical_dosages(source_text)
    generated_dosages = extract_numerical_dosages(generated_text)

    if not generated_dosages:
        return True, []

    errors: List[str] = []
    for dosage in generated_dosages:
        if dosage not in source_dosages:
            errors.append(
                f"Discrepancia de seguridad: la cantidad '{dosage}' generada no está presente en el texto de origen."
            )

    return len(errors) == 0, errors
