---
title: "Seguridad: No Claves API Codificadas"
description: "Evitar la codificación directa de claves API en cualquier archivo."
applicationType: Always
content: |
  Siempre escanear en busca de claves API y reemplazarlas con variables de entorno.
AlwaysApply: true
globs:
  - "**/*"
---

# Seguridad en Claves API y Secretos

## Descripción de la Regla
Esta regla prohíbe estrictamente escribir directamente en el código fuente (hardcoding) claves de API, tokens de autenticación o secretos sensibles.

## Instrucciones de Aplicación
1. **Detección**: Antes de confirmar o guardar código, verificar que no existan credenciales en texto plano.
2. **Uso de Variables de Entorno**: Cualquier clave o secreto debe extraerse a variables de entorno (p. ej. `process.env.NEXT_PUBLIC_API_KEY` o variables de `.env.local`).
3. **Protección**: Prevenir filtraciones de credenciales en repositorios y logs.
