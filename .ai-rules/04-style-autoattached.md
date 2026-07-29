---
title: "Aplicación de Estilos en Componentes"
description: "Aplicar el uso de Tailwind CSS en componentes funcionales."
alwaysApply: false
globs:
  - "src/components/**/*.tsx"
applicationType: AutoAttached
content: |
  Asegurar que no haya estilos en línea; usar solo clases utilitarias de Tailwind.
---

# Guía y Funcionamiento de Estilos en Componentes

## Funcionamiento de la Regla
Esta regla se activa automáticamente (`applicationType: AutoAttached` / `alwaysApply: false` ajustada por `globs`) al trabajar o modificar cualquier componente de React en la ruta `src/components/**/*.tsx`.

## Normas de Estilo:
1. **Sin estilos en línea (`style={{...}}`)**: Evitar completamente el atributo `style` de HTML/JSX salvo en propiedades verdaderamente dinámicas calculadas en tiempo de ejecución.
2. **Uso de clases de Tailwind CSS**: Emplear las clases utilitarias estándar de Tailwind (`flex`, `p-4`, `rounded-lg`, etc.) para garantizar consistencia visual y coherencia con el sistema de diseño.
3. **Mantenibilidad y Limpieza**: Mantener las clases estructuradas y legibles en el JSX.
