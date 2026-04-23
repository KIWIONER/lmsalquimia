import { create } from 'zustand';

export const useChatStore = create((set, get) => ({
    messages: [],
    loading: false,
    isTestActive: false,
    activeTestContent: '',
    activeHighlightCardId: null,
    isOpen: false,
    highlights: [],
    
    // Acciones
    openChat: () => set({ isOpen: true }),
    closeChat: () => set({ isOpen: false }),
    toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),
    setHighlights: (texts) => set({ highlights: texts }),
    addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
    setLoading: (isLoading) => set({ loading: isLoading }),

    setTestActive: (active) => set({ isTestActive: active }),
    setActiveTestContent: (content) => set({ activeTestContent: content }),
    
    // Inicialización proactiva que no sobreescribe mensajes existentes
    initChatIfNeeded: (initialMessage) => set((state) => {
        if (state.messages.length === 0) {
            return { messages: [initialMessage] };
        }
        return state;
    }),

    // Acción centralizada para enviar mensajes a n8n (Gemini)
    sendMessage: async (text, context = {}) => {
        const { addMessage, setLoading, setTestActive, activeTestContent, setActiveTestContent, setHighlights, openChat } = get();

        // ─── FUENTE DE VERDAD: context.isTestRequest manda sobre el estado global ───
        // Esto evita que un test previo (isTestActive=true en el store) contamine
        // una petición de Resumir que llega justo después antes de que Zustand flush.
        const isThisATestRequest  = context.isTestRequest === true;
        const isThisASummaryRequest = context.isTestRequest === false;

        // Sincronizamos el store con la intención real de esta llamada
        if (isThisATestRequest) {
            setTestActive(true);
            set({ activeHighlightCardId: null }); // Los tests no usan subrayado persistente
            if (context.blockContent) setActiveTestContent(context.blockContent);
        } else if (isThisASummaryRequest) {
            setTestActive(false);
            setActiveTestContent('');
            set({ activeHighlightCardId: context.targetBlockId || null });
        } else {
            // Consulta normal
            set({ activeHighlightCardId: null });
        }

        // Limpiamos resaltados previos al iniciar nueva consulta
        setHighlights([]);

        // Aseguramos que el chat esté abierto
        openChat();

        // 1. Añadimos el mensaje del usuario / indicador de sistema al estado
        if (context.isHidden) {
            const systemMsg = isThisATestRequest
                ? 'Generando test de autoevaluación...'
                : 'Generando resumen y subrayado de la tarjeta...';
            addMessage({ role: 'system_info', content: systemMsg });
        } else {
            addMessage({ role: 'user', content: text });
        }

        setLoading(true);

        // 2. Preparamos el input para la IA
        const currentContext = { ...context };

        // Definimos las reglas base
        const systemRulesBase = `
[IDENTIDAD: CEREBRO - TUTOR DOCTORAL DE ALQUIMIA]
Eres "Cerebro", el tutor inteligente y experto de Alquimia LMS. Tu personalidad es culta, pedagógica y profundamente profesional. Tu lengua nativa es el gallego, lo que te otorga un matiz de sabiduría y cercanía, aunque respondes siempre con elegancia y precisión en el idioma que el alumno prefiera (predeterminado: Castellano).

[REGLAS DE ORO DE RESPUESTA]:
1. NAVEGACIÓN PRECISA: Si el alumno pregunta por un punto concreto (ej: "Sección 3.2"), busca el encabezado "##" correspondiente y explícalo.
2. VERACIDAD ABSOLUTA: No inventes datos. No busques información externa. Si algo no consta, di: "No he localizado ese dato específico".
3. TRACEABILIDAD ([[REFS]]): Es OBLIGATORIO. Identifica las frases LITERALES y LARGAS originales del texto. Tras tu respuesta, añade una línea final con este formato: [[REFS: frase literal 1 | frase literal 2 | ...]]
4. FORMATO: Usa EXCLUSIVAMENTE Markdown. PROHIBIDO etiquetas HTML.
5. ESTILO: Tono doctoral y empático. Máximo 3-4 párrafos.
`;

        const toolRules = `
[BASE DE CONOCIMIENTO Y HERRAMIENTAS]
- Tu ÚNICA fuente de verdad son las TARJETAS de la Unidad Didáctica (UD) actual.
- Estás conectado a la herramienta "obtener-documento-actual". Para usarla, debes pasar el valor del slug exacto: "${currentContext.current_slug}".
`;

        let aiInput = "";

        if (isThisATestRequest) {
            const contentToUse = context.blockContent || activeTestContent;
            currentContext.current_slug = 'test-isolated-context';
            currentContext.current_carpeta = 'isolated';
            aiInput = `${systemRulesBase}\n\n[MODO TEST AISLADO]:\r
- ÚNICO contenido válido: "${contentToUse}".\r
- Envía 1 pregunta con 4 opciones.\r
- Tras la pregunta 5, usa [[COMPLETADO]].\n\nORDEN: ${text}`;
        } else if (isThisASummaryRequest) {
            // MODO RESUMEN: Ocultamos las herramientas de búsqueda para que NO intente usar RAG
            // y se vea obligado a usar el bloque de texto que le pasamos por prompt.
            aiInput = `${systemRulesBase}\n\n[MODO RESUMEN CRÍTICO]:\r
- Ignora cualquier otra tarjeta o conocimiento previo.\r
- Usa exclusivamente el bloque de texto proporcionado en la orden siguiente.\n\nORDEN: ${text}`;
        } else {
            // Consulta normal: habilitamos herramientas
            aiInput = `${systemRulesBase}\n${toolRules}\n\nORDEN: ${text}`;
        }

        try {
            const webhookUrl = import.meta.env.PUBLIC_N8N_CEREBRO_URL;
            
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatInput: aiInput,
                    sessionId: context.sessionId || 'estudiante-demo',
                    ...currentContext
                }),
            });

            if (!response.ok) throw new Error('Cerebro no responde');

            const data = await response.json();
            let aiText = data.output || data.response || data.text || "Lo siento, he tenido un problema procesando tu duda.";

            // 3. Procesar Referencias para el resaltado amarillo (ULTRA-ROBUSTO)
            const refsMatch = aiText.match(/\[\[\s*REFS\s*:\s*([\s\S]*?)\s*\]\]/i);
            if (refsMatch) {
                const phrases = refsMatch[1]
                    .split(/[|\|]/)
                    .map(p => p.trim())
                    .filter(p => p.length > 5);
                
                if (phrases.length > 0) {
                    setHighlights(phrases);
                }
                // Limpiamos CUALQUIER variante del tag del texto final
                aiText = aiText.replace(/\[\[\s*REFS\s*:[\s\S]*?\]\]/gi, '').trim();
            }

            addMessage({ role: 'assistant', content: aiText });
        } catch (err) {
            console.error('AI Agent Error:', err);
            addMessage({ 
                role: 'assistant', 
                content: '⚠️ Lo siento, mi conexión con el servidor central de Alquimia se ha interrumpido.' 
            });
        } finally {
            setLoading(false);
        }
    }
}));
