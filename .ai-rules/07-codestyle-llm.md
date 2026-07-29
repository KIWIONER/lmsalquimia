---
title: "Preferencias de Estilo de Código"
description: "Sugerir estilo de código basado en convenciones del proyecto."
alwaysApply: true
globs:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
applicationType: LLMOriented
content: |
  Preferir punto y coma, indentación de 2 espacios y comillas simples.
---

# Preferencias de Estilo de Código

## Funcionamiento de la Regla
Esta regla está orientada a la generación y formateo de código por parte de la IA (`applicationType: LLMOriented` / `alwaysApply: true`), asegurando consistencia con las convenciones del repositorio.

## Convenciones de Formato:
1. **Punto y Coma**: Preferir y usar siempre punto y coma (`;`) al final de las sentencias.
2. **Indentación**: Utilizar indentación de 2 espacios.
3. **Comillas Simples**: Usar comillas simples (`'`) para cadenas de texto, salvo en plantillas de formato (template literals con backticks).
