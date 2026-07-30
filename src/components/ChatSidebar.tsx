'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useChatStore } from '../store/chatStore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';
import { X, CheckCircle, XCircle } from 'lucide-react';

interface ChatSidebarProps {
  unitName?: string;
  moduleName?: string;
  unitSlug?: string;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({ unitName, moduleName, unitSlug }) => {
    const { messages, loading, sendMessage, initChatIfNeeded, addMessage, closeChat, isTestActive } = useChatStore();
    const [input, setInput] = useState('');
    const [isAlerting, setIsAlerting] = useState(false);
    const [selectedOptions, setSelectedOptions] = useState<Record<number, string>>({});
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        initChatIfNeeded({ 
            role: 'assistant', 
            content: `Hola. Soy Cerebro, tu tutor inteligente de Alquimia. Te acompaño durante toda tu navegación, listo para resolver dudas en cualquier tema.` 
        });
    }, [initChatIfNeeded]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    // Subscribirse a notificaciones de fallo (Trigger Proactivo)
    useEffect(() => {
        const channel = supabase
            .channel('lms-triggers')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'lms_notifications', filter: 'type=eq.fail_trigger' },
                (payload: any) => {
                    console.log('🚨 Trigger detectado:', payload.new);
                    handleProactiveSupport(payload.new.unit_id);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleProactiveSupport = (unitId: string) => {
        setIsAlerting(true);
        addMessage({ 
            role: 'assistant', 
            content: `He notado que la evaluación de la ${unitId} está siendo un desafío. ¡No te preocupes! La nutrición clínica requiere tiempo. ¿Quieres que revisemos los conceptos clave de este apartado juntos?`,
        });
        
        // El pulso dura unos segundos para llamar la atención sin molestar
        setTimeout(() => setIsAlerting(false), 5000);
    };

    const normalizeMarkdown = (text: string) => {
        if (!text) return '';
        return text
            .replace(/([^\n])\n([a-d]\))/gi, '$1\n\n$2')
            .replace(/([^\n])\n(\d+\.)/g, '$1\n\n$2')
            .replace(/([^\n])\n(\*\*[^*])/g, '$1\n\n$2')
            .replace(/([^\n])\n(Pregunta\s+\d)/gi, '$1\n\n$2')
            .replace(/([^\n])\n([^\n])/g, '$1\n\n$2');
    };

    const extractOptions = (text: string) => {
        if (!text) return [];
        const lines = text.split('\n');
        const options: Array<{ id: string; text: string; full: string }> = [];
        const optionRegex = /^[\*\_\s]*([a-d])[\.\)\:-]\s*(.*)/i;
        
        lines.forEach((line: string) => {
            const cleanLine = line.trim();
            const match = cleanLine.match(optionRegex);
            if (match) {
                options.push({
                    id: match[1].toLowerCase(),
                    text: match[2].replace(/[\*\_]+$/g, '').trim(),
                    full: cleanLine
                });
            }
        });
        return options;
    };

    const handleOptionSelect = (msgIndex: number, option: { id: string; text: string }) => {
        if (loading) return;
        
        // Guardar la opción pulsada asociada al índice del mensaje en el historial
        setSelectedOptions(prev => ({ ...prev, [msgIndex]: option.id }));
        
        const responseText = `Opción seleccionada: ${option.id}) ${option.text}`;
        
        const currentPath = window.location.pathname;
        const toKebabCase = (str: string) =>
            str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-/]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        const match = currentPath.match(/^\/leccion\/(.*)/);
        let raw_slug = match ? match[1] : '';
        if (!raw_slug && unitName) raw_slug = unitName.replace(/\.(pdf|PDF|docx|DOCX)$/, '');
        const current_slug = toKebabCase(raw_slug);
        const current_carpeta = current_slug.split('/')[0] || "";

        sendMessage(responseText, {
            isHidden: true,
            isOptionSelect: true,
            isTestContinuation: true,
            current_slug,
            current_carpeta
        });
    };

    const handleSend = async (e: React.FormEvent | null, forcedInput: string | null = null) => {
        if (e) e.preventDefault();
        const finalInput = forcedInput || input;
        
        if (!finalInput.trim() || loading) return;

        if (!forcedInput) setInput('');

        // Calculamos el contexto
        const currentPath = window.location.pathname;
        const toKebabCase = (str: string) => {
            return str
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .replace(/\s+/g, '-')
                .replace(/[^a-z0-9-/]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
        };

        const match = currentPath.match(/^\/leccion\/(.*)/);
        let raw_slug = match ? match[1] : '';
        if (!raw_slug && unitName) {
            raw_slug = unitName.replace(/\.(pdf|PDF|docx|DOCX)$/, '');
        }

        const current_slug = toKebabCase(raw_slug);
        const current_carpeta = current_slug.split('/')[0] || "";

        // Llamamos a la acción centralizada
        await sendMessage(finalInput, {
            current_slug,
            current_carpeta
        });
    };

    return (
        <div className="flex flex-col h-full bg-white relative">
            {/* Header del Tutor */}
            <div className={`h-14 border-b flex items-center px-4 justify-between transition-colors duration-500 ${isAlerting ? 'bg-medical-green-100 border-medical-green-300' : 'bg-medical-green-50/50 border-slate-200'}`}>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className={`w-8 h-8 rounded-full bg-slate-200 border border-slate-300 overflow-hidden ${isAlerting ? 'ring-4 ring-medical-green-400 animate-pulse' : ''}`}>
                             {/* Avatar de Alquimia (Ya generado) */}
                             <div className="w-full h-full bg-medical-green-500 flex items-center justify-center text-white font-bold text-xs">P</div>
                        </div>
                        {isAlerting && <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white rounded-full"></div>}
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-xs text-medical-green-900 tracking-tight">Agente Alquimia</span>
                        <span className="text-[10px] text-medical-green-600 font-medium">Conectado • Gemini 2.5</span>
                    </div>
                </div>

                {/* Botón Volver a la Lección */}
                <button
                    onClick={closeChat}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 shadow-sm transition-all touch-target"
                    title="Cerrar chat y volver a la lección"
                >
                    <X size={15} />
                    <span>Volver</span>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg, i) => {
                    if (msg.role === 'system_info') {
                        // Si hay un mensaje posterior, es que este proceso ya terminó
                        const isFinished = i < messages.length - 1;

                        return (
                            <div key={i} className="flex justify-center p-4 animate-in fade-in zoom-in duration-500">
                                <div className={`border rounded-2xl px-6 py-4 flex flex-col items-center gap-3 shadow-sm max-w-[80%] transition-all duration-500 ${isFinished ? 'bg-white border-medical-green-200' : 'bg-medical-green-50 border-medical-green-200/50'}`}>
                                    {isFinished ? (
                                        <div className="w-8 h-8 bg-medical-green-500 rounded-full flex items-center justify-center text-white animate-in zoom-in duration-300">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                    ) : (
                                        <div className="w-8 h-8 border-3 border-medical-green-500 border-t-transparent rounded-full animate-spin"></div>
                                    )}
                                    <span className={`text-[10px] font-black uppercase tracking-widest text-center ${isFinished ? 'text-medical-green-600' : 'text-medical-green-700'}`}>
                                        {isFinished ? '¡Acción Completada con Éxito!' : msg.content}
                                    </span>
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[90%] rounded-2xl p-4 text-sm shadow-sm transition-all overflow-x-auto ${
                                msg.role === 'user' 
                                    ? 'bg-medical-green-500 text-white rounded-tr-none' 
                                    : `rounded-tl-none border ${msg.isProactive ? 'bg-medical-green-50 border-medical-green-200 text-medical-green-900 font-medium' : 'bg-slate-50 text-slate-700 border-slate-200'}`
                            }`}>
                                {msg.role === 'user' ? (
                                    msg.content
                                ) : (
                                    (()=>{
                                        const options = extractOptions(msg.content);
                                        const selectedOptId = selectedOptions[i];
                                        const isInteractive = msg.role === 'assistant' && options.length > 0;

                                        // Buscar la respuesta inmediatamente posterior dada por la IA a esta pregunta
                                        const subsequentMessages = messages.slice(i + 1);
                                        const aiResponseMsg = subsequentMessages.find(m => m.role === 'assistant');
                                        const aiResponseText = aiResponseMsg?.content || '';
                                        const nextMsgText = aiResponseText;

                                        // Extraer la opción correcta devuelta por la IA (p. ej: [[CORRECTA: A]])
                                        const correctMatch = aiResponseText.match(/\[\[\s*CORRECTA\s*:\s*([a-d])\s*\]\]/i);
                                        const correctOptId = correctMatch ? correctMatch[1].toLowerCase() : null;

                                        // Es correcto si las letras coinciden o si la respuesta contiene confirmación afirmativa
                                        const isCorrect = Boolean(
                                            aiResponseText && (
                                                correctOptId 
                                                    ? selectedOptId === correctOptId 
                                                    : /✅|¡correcto!|es correcta|muy bien|acierto/i.test(aiResponseText)
                                            )
                                        );

                                        // Limpiamos el contenido si hay botones interactivos para no duplicar información
                                        let displayContent = msg.content;
                                        if (isInteractive) {
                                            displayContent = msg.content.split('\n')
                                                .filter(line => !line.trim().match(/^[\*\_\s]*([a-d])[\.\)\:-]\s*(.*)/i))
                                                .join('\n');
                                        }

                                        return (
                                            <>
                                                <div className="prose prose-sm max-w-none prose-slate 
                                                    prose-p:leading-relaxed prose-p:mb-3 prose-p:mt-0
                                                    prose-strong:text-slate-900 prose-strong:font-bold
                                                    prose-ul:my-2 prose-ul:pl-4 prose-li:my-1
                                                    prose-ol:my-2 prose-ol:pl-4
                                                    prose-pre:bg-slate-800 prose-pre:text-slate-100 prose-pre:rounded-xl
                                                    prose-a:text-medical-green-600 
                                                    [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs
                                                    [&_th]:border-b-2 [&_th]:border-slate-200 [&_th]:py-2 [&_th]:text-left [&_th]:pr-4
                                                    [&_td]:border-b [&_td]:border-slate-100 [&_td]:py-1.5 [&_td]:pr-4
                                                ">
                                                    <ReactMarkdown
                                                        remarkPlugins={[remarkGfm, remarkBreaks]}
                                                        rehypePlugins={[rehypeRaw]}
                                                    >
                                                        {normalizeMarkdown(displayContent)}
                                                    </ReactMarkdown>
                                                </div>
                                                
                                                {/* BOTONES INTERACTIVOS A/B/C/D */}
                                                {isInteractive && (
                                                    <div className="mt-4 flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                                        {options.map((opt) => {
                                                             const isSelected = selectedOptId === opt.id;
                                                             const isAnswered = Boolean(selectedOptId);

                                                             // Extraer la letra de la opción correcta de la respuesta de la IA (p. ej: [[CORRECTA: B]])
                                                             const correctMatch = nextMsgText.match(/\[\[\s*CORRECTA\s*:\s*([a-d])\s*\]\]/i);
                                                             const correctOptId = correctMatch ? correctMatch[1].toLowerCase() : null;
                                                             const isThisTheCorrectOption = !isCorrect && isAnswered && correctOptId === opt.id;

                                                             let buttonStyle = 'bg-white border-slate-200 text-slate-700 hover:border-medical-green-500 hover:bg-medical-green-50';
                                                             let badgeStyle = 'bg-slate-100 text-slate-400 group-hover:bg-medical-green-500 group-hover:text-white';
                                                             let icon = null;

                                                             if (isSelected) {
                                                                 if (!nextMsgText) {
                                                                     // Mientras se procesa la respuesta
                                                                     buttonStyle = 'bg-medical-green-50 border-medical-green-500 text-medical-green-900 font-bold ring-2 ring-medical-green-500/20 animate-pulse';
                                                                     badgeStyle = 'bg-medical-green-500 text-white';
                                                                 } else if (isCorrect) {
                                                                     // Respuesta correcta elegida
                                                                     buttonStyle = 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold shadow-md ring-2 ring-emerald-500/20';
                                                                     badgeStyle = 'bg-emerald-600 text-white';
                                                                     icon = <CheckCircle size={16} className="text-emerald-600 shrink-0 ml-auto" />;
                                                                 } else {
                                                                     // Respuesta incorrecta elegida
                                                                     buttonStyle = 'bg-rose-50 border-rose-400 text-rose-900 font-bold shadow-md ring-2 ring-rose-400/20';
                                                                     badgeStyle = 'bg-rose-600 text-white';
                                                                     icon = <XCircle size={16} className="text-rose-600 shrink-0 ml-auto" />;
                                                                 }
                                                             } else if (isThisTheCorrectOption) {
                                                                 // Opción correcta resaltada (Highlight en Verde) junto a la respuesta fallada
                                                                 buttonStyle = 'bg-emerald-50/90 border-emerald-500 text-emerald-900 font-bold shadow-md ring-2 ring-emerald-500/30 animate-in fade-in duration-300';
                                                                 badgeStyle = 'bg-emerald-600 text-white';
                                                                 icon = (
                                                                     <div className="flex items-center gap-1.5 ml-auto shrink-0">
                                                                         <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">Correcta</span>
                                                                         <CheckCircle size={16} className="text-emerald-600" />
                                                                     </div>
                                                                 );
                                                             } else if (isAnswered) {
                                                                 buttonStyle = 'bg-slate-50/50 border-slate-100 text-slate-400 opacity-60 pointer-events-none';
                                                                 badgeStyle = 'bg-slate-100 text-slate-300';
                                                             }

                                                             return (
                                                                 <button
                                                                     key={opt.id}
                                                                     disabled={isAnswered || loading}
                                                                     onClick={() => handleOptionSelect(i, opt)}
                                                                     className={`w-full text-left p-3 rounded-xl border transition-all text-xs font-medium shadow-sm group flex gap-3 items-center ${buttonStyle}`}
                                                                 >
                                                                     <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold transition-colors uppercase shrink-0 ${badgeStyle}`}>
                                                                         {opt.id}
                                                                     </span>
                                                                     <span className="flex-1 leading-tight">{opt.text}</span>
                                                                     {icon}
                                                                 </button>
                                                             );
                                                         })}
                                                    </div>
                                                )}

                                                {/* BOTÓN SIGUIENTE PREGUNTA (Si el test está activo y no hay opciones a/b/c/d en pantalla) */}
                                                {isTestActive && !isInteractive && !loading && i === messages.length - 1 && (
                                                    <div className="mt-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                                        <button
                                                            onClick={() => sendMessage('Siguiente pregunta', { isTestContinuation: true })}
                                                            className="w-full py-2.5 px-4 rounded-xl bg-medical-green-500 hover:bg-medical-green-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
                                                        >
                                                            <span>Siguiente Pregunta</span>
                                                            <span>→</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()
                                )}
                            </div>
                        </div>
                    );
                })}
                {loading && (
                    <div className="flex justify-start animate-in fade-in">
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 rounded-tl-none flex gap-1">
                            <div className="w-1.5 h-1.5 bg-medical-green-300 rounded-full animate-bounce"></div>
                            <div className="w-1.5 h-1.5 bg-medical-green-300 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                            <div className="w-1.5 h-1.5 bg-medical-green-300 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-slate-100 bg-white">
                <form onSubmit={handleSend} className="relative">
                    <input 
                        type="text" 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Preguntar al Tutor IA..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-medical-green-500/20 focus:border-medical-green-500 transition-all"
                    />
                    <button 
                        type="submit"
                        aria-label="Enviar mensaje al Tutor IA"
                        title="Enviar mensaje"
                        className="absolute right-2 top-1.5 p-1.5 text-medical-green-600 hover:bg-medical-green-50 rounded-lg transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ChatSidebar;
