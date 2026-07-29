---
title: "Lista de Verificación de Accesibilidad"
description: "Lista para cumplimiento de accesibilidad, aplicada al mencionarla."
alwaysApply: false
globs:
  - "src/components/**/*.tsx"
  - "src/app/**/*.tsx"
applicationType: Manual
content: |
  Verificar roles ARIA, navegación por teclado y contraste de colores.
---

# Lista de Verificación de Accesibilidad

## Funcionamiento de la Regla
Esta regla se activa mediante solicitud manual (`applicationType: Manual` / `alwaysApply: false`) al trabajar en accesibilidad o al mencionarse explícitamente durante la revisión de UI.

## Pautas de Accesibilidad:
1. **Roles y Atributos ARIA**: Garantizar un uso semántico de HTML e incluir `aria-label`, `aria-expanded` y otros atributos en elementos interactivos cuando sea necesario.
2. **Navegación por Teclado**: Asegurar el manejo correcto del foco (`tabIndex`, estados `:focus-visible`) en todos los botones, enlaces y modales.
3. **Contraste de Colores y Legibilidad**: Verificar que las combinaciones de color cumplan con el ratio de contraste adecuado para facilitar la lectura.
