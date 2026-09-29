---
name: card-mini-test
description: Generador y gestor de mini-tests adaptativos de micro-learning basados en tarjetas de lección para el LMS Alquimia.
---

# 📝 Skill: Card Mini-Test Engine (Profesor Alquimia)

Esta **Skill** define la especificación, comportamiento pedagógico, estructura de prompts y contrato de estado para la función de **"Hacer Test" / "Continuar Test"** en las tarjetas de lección del LMS Alquimia.

---

## 🎯 1. Propósito Pedagógico
Permitir al estudiante autoevaluar su comprensión de una tarjeta específica mediante un **mini-test interactivo de 5 preguntas adaptativas** formuladas en tiempo real por el "Profesor Alquimia" a través del proxy de servidor `/api/cerebro` (n8n).

---

## 📋 2. Reglas Invariantes del Prompt

Cualquier invocación de mini-test generada por esta Skill **DEBE** utilizar plantillas estrictas según la etapa del flujo:
- **Para iniciar el test (Pregunta 1):** 👉 [resources/prompt_template.txt](resources/prompt_template.txt)
- **Para evaluar respuestas y continuar (Preguntas 2-5):** 👉 [resources/evaluation_template.txt](resources/evaluation_template.txt)

### Control de Bucle (5 Preguntas Estrictas):
- El gestor de estado (`chatStore.ts`) mantiene el contador `testQuestionCount` (1 a 5).
- Al llegar a la **Pregunta 5/5**, el prompt fuerza la instrucción explícita a la IA: *"ESTA ES LA PREGUNTA 5 DE 5. Muestra la pregunta e incluye obligatoriamente la etiqueta [[COMPLETADO]]"*.
- Esta regla aplica **únicamente a los mini-tests de las tarjetas de lección**, sin afectar el módulo general de evaluación.

### Evaluador Estricto & Resaltado de Respuesta Correcta:
- La IA evalúa la opción elegida contra el contenido de la tarjeta como **verdad absoluta**.
- **Respuesta Correcta (✅)**: Si el alumno acierta, se marca la tarjeta elegida en **Verde (Emerald)**.
- **Respuesta Incorrecta (❌)**: Si el alumno falla, la opción elegida se marca en **Rojo (Rose)** y simultáneamente la opción correcta se **resalta en Verde (Emerald)** con una insignia `"Correcta"` al lado para mostrar inmediatamente cuál era la respuesta acertada.




---

## 🔄 3. Ciclo de Vida del Estado de la Tarjeta

```mermaid
stateDiagram-v2
    [*] --> Inactivo: Tarjeta sin evaluar
    Inactivo --> Solicitando: Clic en "Hacer Test"
    Solicitando --> TestActivo: Recibe Pregunta 1 de IA
    TestActivo --> TestActivo: Clic en "Continuar Test" (Preguntas 2-5)
    TestActivo --> Completado: Recibe etiqueta [[COMPLETADO]]
    Completado --> [*]: Tarjeta marcada verde con CheckCircle
```

### Estados en el Frontend (`LessonContentViewer.tsx` / `chatStore.ts`):
1. **`isCompleted`** (`boolean`): Si la tarjeta ya ha finalizado su test exitosamente.
   - **UI:** Muestra botón verde deshabilitado con etiqueta `✓ COMPLETADO`.
2. **`isTesting`** (`boolean`): Si la tarjeta tiene una sesión de test actualmente abierta.
   - **UI:** Muestra botón azul animado con etiqueta `CONTINUAR TEST`.
3. **`chatLoading`** (`boolean`): Mientras la IA o el proxy `/api/cerebro` responden.
   - **UI:** Deshabilita botones temporalmente.

---

## 💻 4. Especificación del Manejador TypeScript

```typescript
const handleTestClick = async (block: CardBlock) => {
    const isContinuation = isTestActive && activeTestingCardId === block.id;

    if (isContinuation) {
        // Continuar sesión activa
        await sendMessage('Continúa con la siguiente pregunta del test.', {
            current_slug: unitName,
            isTestContinuation: true,
            isHidden: true,
            targetBlockId: block.id
        });
    } else {
        // Iniciar nuevo test
        const prompt = buildMiniTestPrompt(block.titulo, block.contenido);
        await sendMessage(prompt, {
            current_slug: unitName,
            isTestRequest: true,
            isHidden: true,
            blockContent: block.contenido,
            targetBlockId: block.id
        });
    }
};
```

---

## 🛡️ 5. Integración con Supabase Realtime & Reintentos

1. **Trigger de 3 Fallos Consecutivos:** Si el alumno falla 3 veces en un mini-test, el backend en Supabase (PL/pgSQL trigger `check_failed_attempts`) emite un evento en Supabase Realtime para notificar al equipo docente.
2. **Resiliencia de Red:** Si `/api/cerebro` no responde o sufre un timeout, la UI captura el estado 503 sin lanzar excepciones no controladas en consola.
