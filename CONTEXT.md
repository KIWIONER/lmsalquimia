# 🧠 CONTEXT.md — Contexto Maestro del Proyecto LMS Alquimia

> **Plataforma EdTech de Nutrición y Dietética impulsada por IA Adaptativa, Micro-Learning y Next.js 15 App Router**
> *Documento de Contexto para Desarrolladores y Agentes IA | Elaborado con el Método de los 3 Expertos*

---

## 📌 1. Ficha Técnica y Stack Tecnológico Detallado

- **Nombre del Proyecto:** LMS Alquimia (`dimensional-doppler` en [`package.json`](file:///workspaces/lmsalquimia/package.json#L2))
- **Dominio:** EdTech / Educación Superior en Nutrición, Dietética y Bioquímica.
- **Enfoque Pedagógico:** Micro-learning en tarjetas interactivas, tutoría proactiva en tiempo real por IA ("Profesor Alquimia"), evaluación gamificada y resúmenes automáticos.
- **Arquitectura:** **100% Next.js 15 (App Router)** + **React 19** + **TypeScript Estricto** + **Supabase Auth SSR**.

### 🛠️ Tabla de Tecnologías y Versiones

| Capa Tecnológica | Tecnología / Librería | Versión | Propósito en el Proyecto |
| :--- | :--- | :--- | :--- |
| **Core Framework** | `next` | `^15.0.0` | Framework React Full-Stack con App Router, Server Components y Server Actions. |
| **Runtime & Node** | `node` | `>=22.12.0` | Entorno de ejecución de servidor. |
| **UI Framework** | `react` & `react-dom` | `^19.2.5` | React 19 nativo en servidor y cliente. |
| **Autenticación SSR** | `@supabase/ssr` | `^0.5.2` | Autenticación basada en servidor con cookies seguras y middleware de refresco. |
| **Estilos & CSS** | `tailwindcss` & `@tailwindcss/vite` | `^4.2.2` | Motor CSS JIT moderno con tokens personalizados. |
| **Animaciones & Iconos** | `framer-motion` / `lucide-react` | `^12.38.0` / `^1.8.0` | Transiciones fluidas e iconografía vectorial. |
| **Estado Complejo** | `zustand` | `^5.0.12` | Estado reactivo global ([`chatStore.ts`](file:///workspaces/lmsalquimia/src/store/chatStore.ts), [`quizStore.ts`](file:///workspaces/lmsalquimia/src/store/quizStore.ts)). |
| **Estado UI Liviano** | `@nanostores/react` | `^1.1.0` | Estado compartido ligero para la interfaz. |
| **Backend & Base de Datos**| `@supabase/supabase-js` | `^2.103.3` | Cliente PostgreSQL, esquema `nutricionista` y Supabase Realtime. |
| **API Proxy Seguro** | Route Handlers (`app/api/cerebro`) | Next.js API | Proxy de servidor para ocultar Webhooks de n8n y evitar problemas CORS. |
| **Editor Rich Text** | `@tiptap/react` & `@tiptap/starter-kit` | `^3.22.4` | Editor WYSIWYG de contenidos docentes en el panel Admin. |
| **Markdown Extensions** | `tiptap-markdown`, `react-markdown` | `^0.9.0` / `^10.1.0` | Renderizado y edición bidireccional en formato Markdown. |

---

## 🏛️ 2. Arquitectura del Sistema (Visión de los 3 Expertos)

```mermaid
graph TB
    subgraph Capa_UI [Capa de Presentación - Next.js 15 App Router + React 19]
        A[Root Layout: app/layout.tsx]
        B[Paginas: /dashboard, /leccion, /biblioteca, /evaluacion, /admin, /login]
        C[Componente: LessonContentViewer]
        D[Componente: ChatSidebar / Profesor Alquimia]
        E[Componentes: QuizEngine & DocumentEditor]
    end

    subgraph Capa_Estado [Capa de Estado Reactivo & Auth]
        F[Zustand: chatStore.ts]
        G[Zustand: quizStore.ts]
        H[Supabase Auth SSR: middleware.ts & cookies]
    end

    subgraph Capa_Backend [Backend Relacional & Realtime - Supabase]
        I[(Tabla: nutricionista.documentos)]
        J[(Tabla: nutricionista.pasos_completados)]
        K[(Tabla: public.quiz_attempts)]
        L[(Tabla: public.lms_notifications)]
        M[Trigger PL/pgSQL: check_failed_attempts]
    end

    subgraph Capa_IA [API Proxy Server Action & RAG]
        N[Next.js API Handler: app/api/cerebro/route.ts]
        O[Webhook n8n / Cerebro Engine]
        P[LLM Gemini + Vectorstore PDFs Nutrición]
    end

    A --> B
    B --> C
    C --> F
    D --> F
    E --> G
    F -->|POST /api/cerebro| N
    N -->|Proxy seguro servidor| O
    O -->|Prompt RAG| P
    P -->|Parse Output [[REFS]] / [[COMPLETADO]]| F
    B -->|Upsert Progreso| J
    G -->|Insert Intentos| K
    K --> M
    M -->|Dispara Alerta (3 Fallos)| L
    L -->|Realtime Pub/Sub| D
```

---

## 👥 3. Desglose Técnico según el Método de los 3 Expertos

### 👨‍💻 EXPERTO 1: Arquitectura de Software, Backend y Estructura de Datos
*Enfoque: Calidad de código, TypeScript estricto, Next.js 15 App Router y Supabase SSR.*

1. **Estructura del Proyecto y Rutas:**
   - [`app/layout.tsx`](file:///workspaces/lmsalquimia/app/layout.tsx): Root Layout unificado con SSR Auth, fuentes de Google, Navbar y diseño de 3 paneles.
   - [`app/leccion/[...path]/page.tsx`](file:///workspaces/lmsalquimia/app/leccion/[...path]/page.tsx): Ruta dinámica catch-all para lecciones con Server Component fetching y micro-tarjetas.
   - [`src/lib/supabase/server.ts`](file:///workspaces/lmsalquimia/src/lib/supabase/server.ts) & [`src/lib/supabase/client.ts`](file:///workspaces/lmsalquimia/src/lib/supabase/client.ts): Integración oficial de `@supabase/ssr` con cookies seguras de Next.js.
   - [`middleware.ts`](file:///workspaces/lmsalquimia/middleware.ts): Interceptor global para refrescar tokens de sesión y proteger rutas administrativas `/admin`.

2. **Seguridad y API Proxy (Cero Exposición de Webhooks):**
   - **Archivo:** [`app/api/cerebro/route.ts`](file:///workspaces/lmsalquimia/app/api/cerebro/route.ts)
   - Handler de servidor que recibe las solicitudes de la UI y las retransmite de forma segura al Webhook de n8n, protegiendo credenciales y evitando ataques CORS.

---

### 🎓 EXPERTO 2: Pedagogía EdTech, Experiencia de Usuario (UX) y Herramientas de Estudio
*Enfoque: Micro-learning, retención de conocimientos, flujo de creación de contenido y UX.*

1. **Micro-Learning por Tarjetas (*Card-based Learning*):**
   - [`src/components/LessonContentViewer.jsx`](file:///workspaces/lmsalquimia/src/components/LessonContentViewer.jsx): Presenta lecciones divididas en tarjetas independientes con resúmenes de máximo 5 frases, subrayado automático de frases clave y mini-tests de autoevaluación.
2. **Navegación Fluida (Soft Navigation):**
   - Uso de `Link` de `next/link` y `usePathname` para navegación instantánea entre lecciones y módulos sin recargas de página.

---

### 🤖 EXPERTO 3: Inteligencia Artificial, RAG y Workflows de Automatización
*Enfoque: Prompt engineering, integraciones n8n, RAG sobre literatura médica y protocolos de datos.*

1. **System Prompt del Profesor Alquimia:**
   - **Archivo:** [`ai_prompt.md`](file:///workspaces/lmsalquimia/ai_prompt.md)
   - **Personalidad:** Autoridad académica, motivadora y basada en la evidencia científica.
2. **Store de Chat Tipado en TypeScript:**
   - **Archivo:** [`src/store/chatStore.ts`](file:///workspaces/lmsalquimia/src/store/chatStore.ts)
   - Tipado estricto para estados de chat, tests, resúmenes y extracción de etiquetas `[[REFS:...]]` y `[[COMPLETADO]]`.

---

## 🌳 4. Estructura Interna Detallada del Proyecto (Next.js App Router)

```text
/workspaces/lmsalquimia/
├── .github/
│   ├── audit/
│   │   └── AUDIT.md                # Audit oficial generado (Método 3 Expertos)
│   └── workflows/
│       └── deploy.yml              # Pipeline de CI/CD para despliegue
├── app/                            # Directorio Principal Next.js 15 App Router
│   ├── layout.tsx                  # Root Layout con 3 Paneles y Supabase SSR Auth
│   ├── page.tsx                    # Redirección raíz a /dashboard
│   ├── globals.css                 # Importación de estilos globales Tailwind v4
│   ├── dashboard/
│   │   └── page.tsx                # Centro de mando del estudiante
│   ├── biblioteca/
│   │   └── page.tsx                # Explorador de biblioteca académica
│   ├── evaluacion/
│   │   └── page.tsx                # Motor de cuestionarios adaptativos
│   ├── historial/
│   │   └── page.tsx                # Historial de consultas y lecturas
│   ├── planificacion/
│   │   └── page.tsx                # Cronograma Gantt de estudio
│   ├── calendario/
│   │   └── page.tsx                # Calendario académico
│   ├── leccion/
│   │   └── [...path]/
│   │       └── page.tsx            # Visor dinámico de lecciones por slug
│   ├── admin/
│   │   ├── page.tsx                # Panel de administración de contenidos TipTap
│   │   └── calendario/
│   │       └── page.tsx            # Gestión de calendario administrativo
│   ├── login/
│   │   └── page.tsx                # Página de inicio de sesión con Supabase Auth SSR
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts            # Route Handler para confirmación OAuth/Magic Links
│   └── api/
│       └── cerebro/
│           └── route.ts            # Proxy API seguro para el Webhook de n8n
├── middleware.ts                   # Middleware de refresco de sesión Supabase SSR
├── next.config.mjs                 # Configuración principal de Next.js 15
├── package.json                    # Dependencias actualizadas a Next.js, React 19, TypeScript
├── tsconfig.json                   # Configuración de compilación TypeScript estricta
├── ai_prompt.md                    # Prompt de sistema oficial del Profesor Alquimia
├── config.js                       # Configuración auxiliar de entorno
├── CONTEXT.md                      # Contexto maestro del proyecto (Este documento)
└── src/
    ├── components/
    │   ├── ChatSidebar.jsx         # Panel lateral interactivo del chat e intervenciones RAG
    │   ├── DocumentEditor.jsx      # Editor de lecciones TipTap para profesores
    │   ├── FullCalendar.jsx        # Calendario integral interactivo
    │   ├── GanttTimeline.jsx       # Gráfico Gantt de planificación de estudio
    │   ├── LessonContentViewer.jsx # Visor de micro-tarjetas con resaltados y resúmenes IA
    │   ├── LibraryExplorer.tsx     # Explorador de libros React TypeScript
    │   ├── SidebarHierarchy.tsx    # Jerarquía del menú lateral React TypeScript con Realtime
    │   └── quiz/
    │       └── QuizEngine.jsx      # Motor principal de ejecuciones de quiz
    ├── lib/
    │   ├── books.ts                # Capa de datos: fetch de módulos/unidades y progreso
    │   ├── content.js              # Algoritmo de parsing y fragmentación en micro-tarjetas
    │   ├── supabase.ts             # Cliente singleton de conexión Supabase
    │   └── supabase/
    │       ├── client.ts           # Cliente Supabase navegador (@supabase/ssr)
    │       ├── server.ts           # Cliente Supabase servidor (@supabase/ssr)
    │       └── middleware.ts       # Handler de actualización de sesión para middleware
    └── store/
        ├── chatStore.ts            # Zustand TypeScript: Chat, RAG, subrayados y tests IA
        ├── quizStore.ts            # Zustand TypeScript: Banco de preguntas y temporizador
        └── uiStore.ts              # Nano Stores: Estado reactivo de interfaz
```
