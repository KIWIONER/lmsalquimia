---
title: "Agregar comentarios explicativos a patrones regex"
description: "Asegurar que la IA siempre incluya comentarios detallados que expliquen el patrón regex utilizado."
scope: user
alwaysApply: false
globs:
  - "src/components/**/*.tsx"
  - "src/utils/*.ts"
---

# Comentarios en Patrones Regex

Al crear o modificar expresiones regulares (regex) en componentes o utilidades:

1. Incluir siempre un comentario descriptivo encima del patrón regex explicando qué valida o busca.
2. Desglosar las partes complejas del patrón si aplica para facilitar el mantenimiento.
