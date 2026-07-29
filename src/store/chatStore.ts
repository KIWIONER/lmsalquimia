import { create } from 'zustand';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system_info';
  content: string;
  isProactive?: boolean;
}

export interface ChatContext {
  isTestRequest?: boolean;
  isHighlightRequest?: boolean;
  isTestContinuation?: boolean;
  isHidden?: boolean;
  targetBlockId?: string;
  blockContent?: string;
  sessionId?: string;
  current_slug?: string;
  [key: string]: any;
}

export interface ChatState {
  messages: ChatMessage[];
  loading: boolean;
  isTestActive: boolean;
  activeTestContent: string;
  activeTestSessionId: string | null;
  activeTestingCardId: string | null;
  completedCardIds: string[];
  summarizedCardIds: string[];
  cardHighlights: Record<string, string[]>;
  isOpen: boolean;

  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
  addMessage: (msg: ChatMessage) => void;
  setLoading: (val: boolean) => void;
  setTestActive: (val: boolean) => void;
  setActiveTestContent: (content: string) => void;
  setActiveTestingCardId: (id: string | null) => void;
  markCardCompleted: (cardId: string) => void;
  endTest: () => void;
  markCardSummarized: (cardId: string) => void;
  setCardHighlights: (cardId: string, phrases: string[]) => void;
  clearCardHighlights: (cardId: string) => void;
  initChatIfNeeded: (initialMessage: ChatMessage) => void;
  sendMessage: (text: string, context?: ChatContext) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  loading: false,

  // ── Estado del Test ──
  isTestActive: false,
  activeTestContent: '',
  activeTestSessionId: null,
  activeTestingCardId: null,
  completedCardIds: [],

  // ── Estado de Resúmenes ──
  summarizedCardIds: [],

  // ── Estado de Subrayados ──
  cardHighlights: {},

  // ── Chat UI ──
  isOpen: false,

  // ── Acciones básicas ──
  openChat: () => set({ isOpen: true }),
  closeChat: () => set({ isOpen: false }),
  toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  setLoading: (val) => set({ loading: val }),

  // ── Test ──
  setTestActive: (val) => set({ isTestActive: val }),
  setActiveTestContent: (content) => set({ activeTestContent: content }),
  setActiveTestingCardId: (id) => set({ activeTestingCardId: id }),
  markCardCompleted: (cardId) =>
    set((state) => ({
      completedCardIds: [...new Set([...state.completedCardIds, cardId])],
    })),
  endTest: () =>
    set((state) => {
      const cardToMark = state.activeTestingCardId;
      return {
        isTestActive: false,
        activeTestSessionId: null,
        activeTestingCardId: null,
        completedCardIds: cardToMark
          ? [...new Set([...state.completedCardIds, cardToMark])]
          : state.completedCardIds,
      };
    }),

  // ── Resúmenes ──
  markCardSummarized: (cardId) =>
    set((state) => ({
      summarizedCardIds: [...new Set([...state.summarizedCardIds, cardId])],
    })),

  // ── Subrayados ──
  setCardHighlights: (cardId, phrases) =>
    set((state) => ({
      cardHighlights: { ...state.cardHighlights, [cardId]: phrases },
    })),
  clearCardHighlights: (cardId) =>
    set((state) => {
      const next = { ...state.cardHighlights };
      delete next[cardId];
      return { cardHighlights: next };
    }),

  // ── Chat ──
  initChatIfNeeded: (initialMessage) =>
    set((state) => {
      if (state.messages.length === 0) return { messages: [initialMessage] };
      return state;
    }),

  // ── sendMessage: Hub central de comunicación con /api/cerebro (Next.js API Route) ──
  sendMessage: async (text: string, context: ChatContext = {}) => {
    const { addMessage, setLoading, openChat, setCardHighlights, markCardSummarized, endTest } =
      get();

    const isTestRequest = context.isTestRequest === true;
    const isSummaryRequest = context.isTestRequest === false;
    const isHighlightRequest = context.isHighlightRequest === true;
    const isTestContinuation = context.isTestContinuation === true;

    // ── Iniciar sesión nueva para un test fresco ──
    if (isTestRequest) {
      const testSessionId = `test-${context.targetBlockId || 'card'}-${Date.now()}`;
      set({
        isTestActive: true,
        activeTestSessionId: testSessionId,
        activeTestingCardId: context.targetBlockId || null,
      });
      if (context.blockContent) get().setActiveTestContent(context.blockContent);
    }

    openChat();

    // ── Indicador visual en el chat ──
    if (context.isHidden) {
      let infoText = 'Procesando...';
      if (isTestRequest) infoText = 'Generando test de autoevaluación...';
      else if (isSummaryRequest) infoText = 'Generando resumen de la tarjeta...';
      else if (isHighlightRequest) infoText = 'Analizando contenido para subrayar...';
      else if (isTestContinuation) infoText = 'Generando siguiente pregunta...';
      addMessage({ role: 'system_info', content: infoText });
    } else {
      addMessage({ role: 'user', content: text });
    }

    setLoading(true);

    const freshState = get();

    // ── Construcción del prompt ──
    const sysRules = `Eres "Cerebro", tutor experto de Alquimia LMS.
IDIOMA: Responde SIEMPRE EN CASTELLANO, sin excepción.
REGLAS: No inventes nada. Usa solo el contenido proporcionado. Formato Markdown puro.`;

    let aiInput = '';
    let sessionId = context.sessionId || 'estudiante-demo';

    if (isTestRequest) {
      sessionId = freshState.activeTestSessionId || `test-${Date.now()}`;
      aiInput = `${sysRules}

=== MODO TEST ===
USA SOLO ESTE TEXTO (ningún otro):
"""
${context.blockContent}
"""
Envía UNA pregunta con 4 opciones (a/b/c/d). Tras la 5ª pregunta escribe [[COMPLETADO]].

ORDEN: ${text}`;
    } else if (isTestContinuation) {
      sessionId = freshState.activeTestSessionId || `test-resume-${Date.now()}`;
      aiInput = `${sysRules}

=== CONTINUANDO TEST ===
USA SOLO ESTE TEXTO (ningún otro):
"""
${freshState.activeTestContent}
"""
El alumno solicita la siguiente pregunta. Continúa sin repetir preguntas ya hechas.
Tras la 5ª pregunta escribe [[COMPLETADO]].

ORDEN: Envía la siguiente pregunta.`;
    } else if (isHighlightRequest) {
      aiInput = `${sysRules}

=== ANÁLISIS PARA SUBRAYADO ===
Analiza el siguiente texto y extrae las 15-20 frases más importantes y representativas.
Texto:
"""
${context.blockContent}
"""
Responde SOLO con el siguiente formato (sin texto adicional):
[[REFS: frase literal 1 | frase literal 2 | ... | frase literal 20]]`;
    } else if (isSummaryRequest) {
      aiInput = `${sysRules}

=== RESUMEN ===
Resume ÚNICAMENTE este texto en máximo 5 frases clave. Sin añadir información externa.
Texto:
"""
${context.blockContent}
"""

ORDEN: ${text}`;
    } else {
      if (freshState.isTestActive && freshState.activeTestSessionId) {
        sessionId = freshState.activeTestSessionId;
        aiInput = `${sysRules}

=== CONTINUANDO TEST ===
USA SOLO ESTE TEXTO (ningún otro):
"""
${freshState.activeTestContent}
"""
Da feedback breve a la respuesta del alumno y envía la SIGUIENTE pregunta.
Tras la 5ª escribe [[COMPLETADO]].

RESPUESTA DEL ALUMNO: ${text}`;
      } else {
        aiInput = `${sysRules}

Tienes acceso a "obtener-documento-actual" para el slug: "${context.current_slug || ''}".

PREGUNTA: ${text}`;
      }
    }

    try {
      const payload = {
        chatInput: aiInput,
        sessionId,
        isTestRequest: isTestRequest || freshState.isTestActive,
        ...context,
      };

      const webhookUrl =
        process.env.NEXT_PUBLIC_N8N_CEREBRO_URL ||
        'https://cerebro.agencialquimia.com/webhook/cerebro-nutricionista';

      let response: Response;

      try {
        response = await fetch('/api/cerebro', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        // En hosts estáticos como GitHub Pages (output: 'export'), las API Routes devuelven 405 o 404
        if (response.status === 405 || response.status === 404) {
          response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        }
      } catch (localApiError) {
        // Fallback en cliente si no hay servidor backend Next.js disponible
        response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) throw new Error('Cerebro no responde');

      const data = await response.json();
      let aiText =
        data.output || data.response || data.text || 'Error al procesar la solicitud.';

      // ── Extraer REFS para subrayado ──
      const refsMatch = aiText.match(/\[\[\s*REFS\s*:\s*([\s\S]*?)\s*\]\]/i);
      if (refsMatch) {
        if (context.targetBlockId) {
          const phrases = refsMatch[1]
            .split(/[|\|]/)
            .map((p: string) => p.trim())
            .filter((p: string) => p.length > 5);
          if (phrases.length > 0) {
            setCardHighlights(context.targetBlockId, phrases);
          }
        }
        aiText = aiText.replace(/\[\[\s*REFS\s*:[\s\S]*?\]\]/gi, '').trim();
      }

      // ── Petición de solo subrayado: no añadir al chat ──
      if (isHighlightRequest) {
        return;
      }

      // ── Marcar tarjeta como resumida ──
      if (isSummaryRequest && context.targetBlockId) {
        markCardSummarized(context.targetBlockId);
      }

      // ── Detectar fin de test ──
      if (aiText.includes('[[COMPLETADO]]')) {
        endTest();
        aiText = aiText.replace(/\[\[COMPLETADO\]\]/gi, '').trim();
      }

      addMessage({ role: 'assistant', content: aiText });
    } catch (err) {
      console.error('AI Agent Error:', err);
      addMessage({
        role: 'assistant',
        content:
          '⚠️ Lo siento, mi conexión con el servidor se ha interrumpido. Puedes volver a intentarlo.',
      });
    } finally {
      setLoading(false);
    }
  },
}));
