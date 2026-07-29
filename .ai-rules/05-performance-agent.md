---
title: "Guía de Optimización de Rendimiento"
description: "Ofrecer consejos de optimización cuando la IA discuta rendimiento."
alwaysApply: false
globs:
  - "src/**/*.tsx"
  - "src/**/*.ts"
applicationType: AgentRequested
content: |
  Sugerir memoización, carga diferida y división de código donde sea apropiado.
---

# Guía de Optimización de Rendimiento

## Funcionamiento de la Regla
Esta regla se activa bajo demanda del agente (`applicationType: AgentRequested` / `alwaysApply: false`) al discutir o refactorizar la eficiencia y el rendimiento del código en TypeScript y React dentro de `src/`.

## Instrucciones y Pautas de Rendimiento:
1. **Memoización**: Sugerir `useMemo` y `useCallback` en cálculos costosos o componentes propensos a re-renders innecesarios.
2. **Carga Diferida (Lazy Loading)**: Implementar `React.lazy()` e importaciones dinámicas (`next/dynamic`) para componentes o librerías pesadas.
3. **División de Código (Code Splitting)**: Promover la separación de módulos para reducir el tamaño del bundle inicial.
