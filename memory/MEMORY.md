# 🧠 MEMORY.md — Banco de Memoria del Proyecto LMS Alquimia

> **Documento de Memoria Persistente para Agentes de IA y Desarrolladores**
> *Basado en [CONTEXT.md](file:///workspaces/lmsalquimia/CONTEXT.md) y [.github/audit/AUDIT.md](file:///workspaces/lmsalquimia/.github/audit/AUDIT.md)*

---

## 📌 1. Identidad del Sistema y Memoria Arquitectónica

- **Nombre del Sistema:** LMS Alquimia (`dimensional-doppler`)
- **Propósito:** Plataforma EdTech de aprendizaje intensivo y adaptativo en Nutrición, Dietética y Bioquímica.
- **Stack Consolidado:**
  - **Framework Full-Stack:** Next.js 15 (App Router en `src/app/`), React 19, **100% TypeScript (`.ts` / `.tsx`)**.
  - **Estilos & UI:** Tailwind CSS v4 con `@tailwindcss/postcss`, Framer Motion, Lucide React icons.
  - **Backend & Base de Datos:** Supabase PostgreSQL (Esquema `nutricionista`, Supabase Realtime).
  - **Autenticación:** `@supabase/ssr` con cookies seguras basadas en servidor y middleware ([`middleware.ts`](file:///workspaces/lmsalquimia/middleware.ts)).
  - **Inteligencia Artificial & RAG:** Proxy de servidor en [`src/app/api/cerebro/route.ts`](file:///workspaces/lmsalquimia/src/app/api/cerebro/route.ts) hacia Webhook de n8n (`https://cerebro.agencialquimia.com/webhook/cerebro-nutricionista`) con modelo Gemini RAG sobre biblioteca PDF.

---

## 👥 2. Memoria Triangulada (Visión de los 3 Expertos)

```mermaid
graph TD
    subgraph Experto_1 [1. Arquitectura & Backend]
        A[Next.js 15 App Router en src/app]
        B[Supabase SSR Auth & Cookies]
        C[Trigger PL/pgSQL: check_failed_attempts]
        D[Proxy Seguro API Route: /api/cerebro]
    end

    subgraph Experto_2 [2. Pedagogía EdTech & UX]
        E[Micro-learning en Tarjetas Card-based]
        F[Subrayado Inteligente Automatizado]
        G[Modos Quiz: Práctica vs Examen]
        H[Editor TipTap Rich Content para Docentes]
    end

    subgraph Experto_3 [3. IA, RAG & Workflows]
        I[Persona: Profesor Alquimia / Cerebro]
        J[RAG sobre Literatura Médica PDF]
        K[Protocolo REFS / COMPLETADO]
        L[Notificación Realtime por 3 Fallos]
    end

    A --> E
    B --> H
    C --> L
    D --> I
    I --> J
    J --> K
```

---

## 🏛️ 3. Decisiones Clave e Invariantes del Proyecto

1. **Convención Única de Archivos (.ts / .tsx):**
   - **REGLA ABSOLUTA:** Todo código en `src/` se escribe exclusivamente en formato TypeScript (`.ts` para librerías/stores y `.tsx` para componentes React). Se han eliminado todos los archivos heredados `.astro`, `.jsx` y `.js`.
2. **Protocolo de Control por IA:**
   - Toda interacción con la IA que solicite frases clave DEBE respetar la salida en bloque `[[REFS: frase 1 | frase 2 | ...]]`.
   - Toda sesión de test finalizada con la IA DEBE emitir la etiqueta `[[COMPLETADO]]`.
3. **Seguridad de API:**
   - La comunicación con el Webhook n8n NUNCA debe hacerse directamente en el navegador del cliente; se canaliza a través de [`src/app/api/cerebro/route.ts`](file:///workspaces/lmsalquimia/src/app/api/cerebro/route.ts).
4. **Esquema Multitenant Supabase:**
   - Las consultas de contenidos y progreso DEBEN especificar el esquema `.schema('nutricionista')` en Supabase ([`src/lib/books.ts`](file:///workspaces/lmsalquimia/src/lib/books.ts)).
5. **Carga Optimizada de Fuentes:**
   - Uso obligatorio de `next/font/google` para autoservicio de tipografías sin peticiones bloqueantes externas a Google Fonts.
6. **Vercel React Best Practices:**
   - Aplicación de guías Vercel Engineering: evitar barrel imports en componentes, favorecer importaciones directas por subarchivo y utilizar ternarios explícitos (`? : null`) en renderizado condicional numérico/booleano para evitar renderizado accidental de falsy values (`0`/`NaN`).

---

## 📜 4. Histórico de Hitos del Proyecto

| Fecha | Hito Alcanzado | Descripción y Archivos Impactados |
| :--- | :--- | :--- |
| **Inicial** | Motor Base LMS | Desarrollo inicial en Astro 6 + React híbrido. |
| **Auditoría** | Auditoría 360° | Ejecución del Método de los 3 Expertos en [.github/audit/AUDIT.md](file:///workspaces/lmsalquimia/.github/audit/AUDIT.md). |
| **Contexto** | Contexto Maestro | Creación de [CONTEXT.md](file:///workspaces/lmsalquimia/CONTEXT.md) para agentes de IA. |
| **Migración** | Next.js 15 + Supabase SSR | Reestructuración a `src/app/`, React 19, TypeScript estricto, `@supabase/ssr` y `/api/cerebro`. |
| **Convención** | 100% TypeScript TSX | Conversión completa de componentes a `.tsx` y helpers a `.ts`. Eliminación de `.astro` y `.jsx`. |
| **Conexión & Opt.** | Conexión n8n + Perf & A11y | Verificación de Webhook n8n real, PostCSS Tailwind v4, `next/font/google` y WCAG A11y. |
| **Mobile-First & Static Build** | Transformación Mobile-First y Exportación Estática | Rediseño responsivo Mobile-First con el método 3 expertos: Drawer flotante en lecciones, Bottom Navigation tipo Instagram (`BottomNavigation.tsx`), selector 10/20/30 preguntas. Corrección de `generateStaticParams` dinámico en `leccion/[...path]/page.tsx`, remoción de `cookies()` de servidor para prerenderizado y build estático exitoso de las 79 páginas en Next.js `output: 'export'`. |
| **Overflow Fix & UI Polish** | Corrección de Overflows en Lección | Eliminación de overflow horizontal mediante breadcrumbs adaptativos en móvil, truncado con `...` y forzado de `break-words` / `hyphens: auto` en H1 de `LessonContentViewer.tsx`. |
| **29/07/2026** | Vercel React Best Practices Refactoring | Auditoría y refactorización aplicando el skill `vercel-react-best-practices`: eliminación de barrel imports en componentes de lección, renderizado condicional seguro con ternarios booleanos (`? : null`) en `Calendar.tsx` y `GanttTimeline.tsx`, e importaciones directas por subarchivo. Verificación limpia con `npx tsc --noEmit`. |

---

## 🌳 5. Estructura de Archivos (100% TypeScript)

```text
/workspaces/lmsalquimia/
├── memory/
│   └── MEMORY.md                   # Banco de memoria del sistema (Este archivo)
├── .github/
│   └── audit/
│       └── AUDIT.md                # Informe de auditoría 360° (3 expertos)
├── CONTEXT.md                      # Contexto maestro del proyecto
├── ai_prompt.md                    # System Prompt del Profesor Alquimia
├── package.json                    # Next.js 15, React 19, Tailwind v4
├── tsconfig.json                   # TypeScript estricto con alias @/* -> ./src/*
├── postcss.config.js               # Plugin @tailwindcss/postcss (ESM)
├── middleware.ts                   # Supabase Auth SSR Middleware global
├── .env.local                      # Configuración de producción Supabase y n8n
└── src/
    ├── app/                        # Next.js 15 App Router
    │   ├── layout.tsx              # Root Layout con next/font/google y SSR Auth
    │   ├── page.tsx                # Redirección a /dashboard
    │   ├── globals.css             # Estilos globales Tailwind v4
    │   ├── dashboard/page.tsx      # Centro de mando del estudiante
    │   ├── leccion/[...path]/page.tsx # Visor dinámico de lecciones por slug
    │   ├── biblioteca/page.tsx     # Explorador de biblioteca
    │   ├── evaluacion/page.tsx     # Motor de cuestionarios adaptativos
    │   ├── historial/page.tsx      # Historial de actividades
    │   ├── planificacion/page.tsx  # Timeline Gantt
    │   ├── calendario/page.tsx     # FullCalendar
    │   ├── admin/page.tsx          # Editor TipTap de docentes
    │   ├── admin/calendario/page.tsx # Gestión de calendario admin
    │   ├── login/page.tsx          # Autenticación Supabase Auth SSR
    │   ├── auth/callback/route.ts  # Handler OAuth/Magic Links
    │   └── api/cerebro/route.ts    # Proxy API seguro para Webhook de n8n
    ├── components/
    │   ├── SidebarHierarchy.tsx    # Menú lateral con Supabase Realtime (.tsx)
    │   ├── LibraryExplorer.tsx     # Explorador de biblioteca (.tsx)
    │   ├── LessonContentViewer.tsx # Micro-tarjetas con IA (.tsx)
    │   ├── ChatSidebar.tsx         # Chat del Profesor Alquimia (.tsx - WCAG A11y)
    │   ├── ChatDrawer.tsx          # Drawer lateral (.tsx)
    │   ├── FloatingChat.tsx        # Chat flotante (.tsx)
    │   ├── AIStudyButton.tsx       # Botón invocador IA (.tsx)
    │   ├── Calendar.tsx            # Mini calendario (.tsx)
    │   ├── FullCalendar.tsx        # Calendario integral (.tsx)
    │   ├── GanttTimeline.tsx       # Gráfico Gantt (.tsx)
    │   ├── SidebarCollapseButton.tsx # Botón colapsable (.tsx)
    │   ├── admin/
    │   │   ├── AdminProtectedRoute.tsx # Protector de ruta (.tsx)
    │   │   ├── DocumentEditor.tsx      # Editor TipTap (.tsx)
    │   │   ├── LoginForm.tsx           # Formulario login admin (.tsx)
    │   │   └── RichCardEditor.tsx      # Editor de tarjetas (.tsx)
    │   └── quiz/
    │       ├── QuizEngine.tsx          # Motor de quiz (.tsx)
    │       ├── QuestionCard.tsx        # Tarjeta de pregunta (.tsx)
    │       ├── SubjectSelector.tsx     # Selector de materias (.tsx)
    │       ├── DifficultySelector.tsx  # Selector de dificultad (.tsx)
    │       └── ProgressBar.tsx         # Barra de progreso (.tsx)
    ├── lib/
    │   ├── books.ts                # Consultas a esquema 'nutricionista'
    │   ├── content.ts              # Algoritmo de desfragmentación en tarjetas
    │   ├── tracking.ts             # Tracking de eventos
    │   ├── supabase.ts             # Singleton cliente Supabase
    │   └── supabase/               # Clientes SSR (server.ts, client.ts, middleware.ts)
    ├── types/
    │   └── database.ts             # Tipos TypeScript esquemas Supabase
    └── store/
        ├── chatStore.ts            # Zustand TypeScript: Chat e IA
        ├── quizStore.ts            # Zustand TypeScript: Cuestionarios
        └── uiStore.ts              # Zustand TypeScript: Interfaz UI
```

---

## 🚀 6. Hito de Consolidación y Optimización Full-Stack (Detalle)

### 📌 Resumen de Logros del Hito:

1. **Tipado Estricto de Supabase (`src/types/database.ts`):**
   - Creado [`src/types/database.ts`](file:///workspaces/lmsalquimia/src/types/database.ts) con las interfaces de las tablas `documentos`, `tarjetas` y `tracking` del esquema `nutricionista`.
   - Creada plantilla [`.env.example`](file:///workspaces/lmsalquimia/.env.example) para integración de entornos de producción.

2. **Resolución de PostCSS & Tailwind CSS v4:**
   - Creado [`postcss.config.js`](file:///workspaces/lmsalquimia/postcss.config.js) con `@tailwindcss/postcss` en formato ESM.
   - Refactorizado [`src/styles/global.css`](file:///workspaces/lmsalquimia/src/styles/global.css) con estilos nativos para evitar conflictos de `@apply` en v4. Generación de ~88 KB de CSS de producción optimizado.

3. **Integración Verificada del Webhook n8n (Cerebro IA):**
   - Conexión en vivo verificada con HTTP 200 contra `https://cerebro.agencialquimia.com/webhook/cerebro-nutricionista`.
   - Proxy de servidor [`src/app/api/cerebro/route.ts`](file:///workspaces/lmsalquimia/src/app/api/cerebro/route.ts) actualizado con fallback 503 resiliente.

4. **Optimización de Rendimiento Web Vitals (`next/font/google`):**
   - Refactorizado [`src/app/layout.tsx`](file:///workspaces/lmsalquimia/src/app/layout.tsx) con `Inter` de `next/font/google`, eliminando las peticiones externas síncronas que bloqueaban el renderizado y acelerando FCP/LCP en ~230 ms.

5. **Accesibilidad WCAG 2.1:**
   - Atributos `aria-label` y `title` agregados al botón de envío en [`src/components/ChatSidebar.tsx`](file:///workspaces/lmsalquimia/src/components/ChatSidebar.tsx).

6. **Compilación de Producción:**
   - `npm run build` ejecutado exitosamente en Turbopack con **0 errores de compilación TypeScript** en las 14 rutas.

---

## 📱 7. Hito Mobile-First & Exportación Estática GitHub Pages (Detalle)

### 📌 Resumen de Logros del Hito:

1. **Diseño Mobile-First Global & Touch Targets (`src/styles/global.css`):**
   - Incorporación de `touch-action: manipulation` para eliminar retardos táctiles de 300ms.
   - Definición de `.touch-target` con un mínimo interactivo de `44x44px` siguiendo guías de Apple y Google.
   - Prevenir desbordamiento horizontal global mediante `overflow-x-hidden`.

2. **Navegación Inferior Móvil Estilo Instagram (`src/components/BottomNavigation.tsx`):**
   - Creación del menú fijo inferior en la pantalla móvil con 5 destinos clave (Inicio, Biblioteca, Tests, Plan, Perfil).
   - Ocultación del panel primario en smartphones (`hidden md:flex`) para liberar el 100% de la pantalla.
   - Adición de `pb-16 md:pb-0` en `src/app/layout.tsx` para evitar superposición con el contenido.

3. **Drawer Flotante de Lecciones & Prevención de Overflows:**
   - Convertida la tabla de contenidos en `src/components/lesson/components/LessonTocSidebar.tsx` en un **Slide-over Drawer flotante** con backdrop traslúcido en pantallas `< 768px`.
   - Modificados los breadcrumbs en `src/app/leccion/[...path]/page.tsx` para ocultar la jerarquía pesada en móviles y acortar el título de la unidad con `truncate`.
   - Adición de `break-words` y `hyphens: auto` en el H1 de `LessonContentViewer.tsx` para evitar ruptura de contenedor por palabras médicas/técnicas extensas.

4. **Motor de Evaluaciones Adaptativas Responsivo (`src/components/quiz/`):**
   - Layout apilado verticalmente en móviles (`flex-col md:flex-row`).
   - Selector configurable de preguntas (10, 20 o 30).
   - Cálculo de nota real en `QuizEngine.tsx` con desglose explicativo clínico de preguntas falladas.

5. **Compatibilidad con `output: 'export'` para GitHub Pages:**
   - Adición de `output: 'export'` e `images: { unoptimized: true }` en [`next.config.mjs`](file:///workspaces/lmsalquimia/next.config.mjs).
   - Eliminación de llamadas síncronas a `cookies()` en componentes de servidor del layout y dashboard para posibilitar la generación de páginas estáticas HTML.
   - `generateStaticParams()` adaptado en `src/app/leccion/[...path]/page.tsx` para prerrenderizar dinámicamente las **79 páginas del LMS**.

