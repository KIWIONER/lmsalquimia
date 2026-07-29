'use client';

import React, { useState, useRef } from 'react';
import { useUIStore } from '../../store/uiStore';
import { useChatStore } from '../../store/chatStore';
import { useLessonCards, LessonBlock } from './hooks/useLessonCards';
import { useTextHighlighter } from './hooks/useTextHighlighter';
import { LessonTocSidebar } from './components/LessonTocSidebar';
import { LessonCard } from './components/LessonCard';
import { supabase } from '../../lib/supabase';
import { trackEvent } from '../../lib/tracking';
import { CheckCircle, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

export interface LessonContentViewerProps {
    docId?: string;
    unitName?: string;
    moduleName?: string;
}

const LessonContentViewer: React.FC<LessonContentViewerProps> = ({ docId, unitName, moduleName }) => {
    const { isLeftSidebarOpen, toggleLeftSidebar } = useUIStore();
    const { blocks, loading } = useLessonCards(docId);
    const { highlightModeCardId, handleHighlightToggle, handleContentMouseUp, contentRefs } = useTextHighlighter(blocks);
    const {
        sendMessage,
        cardHighlights,
        clearCardHighlights,
        summarizedCardIds,
        completedCardIds,
        activeTestingCardId
    } = useChatStore();

    const [isInnerSidebarOpen, setIsInnerSidebarOpen] = useState(true);
    const [isCompletedUnit, setIsCompletedUnit] = useState(false);
    const cardRefs = useRef<Record<string | number, HTMLElement | null>>({});

    const scrollToBlock = (id: string | number) => {
        const el = cardRefs.current[id];
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            el.classList.add('ring-2', 'ring-medical-green-500', 'ring-offset-4');
            setTimeout(() => el.classList.remove('ring-2', 'ring-medical-green-500', 'ring-offset-4'), 2000);
        }
    };

    const handleStartTest = (block: LessonBlock) => {
        sendMessage(`Generar mini-test adaptativo para la sección: "${block.titulo}"`, {
            isHidden: true,
            isTestRequest: true,
            blockContent: block.contenido,
            targetBlockId: String(block.id)
        });
    };

    const handleSummarize = (block: LessonBlock) => {
        sendMessage(`Resumir la sección: "${block.titulo}"`, {
            isHidden: true,
            isTestRequest: false,
            blockContent: block.contenido,
            targetBlockId: String(block.id)
        });
    };

    const handleToggleCompleteUnit = async () => {
        const nextState = !isCompletedUnit;
        setIsCompletedUnit(nextState);
        if (docId) {
            try {
                await supabase
                    .schema('nutricionista')
                    .from('pasos_completados')
                    .upsert({ user_id: 'estudiante-demo', document_slug: docId });
                trackEvent('unit_completed', { docId, unitName });
            } catch (err) {
                console.error('Error saving unit progress:', err);
            }
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 w-full h-full">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-medical-green-500 rounded-full animate-spin"></div>
                <p className="text-sm font-medium text-slate-500 animate-pulse">Cargando tarjetas educativas...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col flex-1 w-full h-full overflow-hidden bg-slate-50">
            {/* Header Superior y Barra de Herramientas de Lección */}
            <div className="sticky top-0 z-30 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsInnerSidebarOpen(!isInnerSidebarOpen)}
                        className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl transition-all"
                    >
                        {isInnerSidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
                        <span>{isInnerSidebarOpen ? 'Ocultar Índice' : 'Ver Índice'}</span>
                    </button>
                    <span className="text-xs text-slate-400 font-medium">| {blocks.length} Tarjetas</span>
                </div>

                <button
                    onClick={handleToggleCompleteUnit}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                        isCompletedUnit
                            ? 'bg-medical-green-500 text-white'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                >
                    <CheckCircle size={16} />
                    <span>{isCompletedUnit ? 'Lección Completada' : 'Marcar como Completada'}</span>
                </button>
            </div>

            {/* Layout Horizontal: Sidebar Vertical Izquierdo + Área de Tarjetas */}
            <div className="flex flex-1 w-full h-full overflow-hidden">
                {/* Índice Lateral Izquierdo Vertical */}
                <LessonTocSidebar
                    blocks={blocks}
                    completedCardIds={completedCardIds}
                    activeTestingCardId={activeTestingCardId}
                    summarizedCardIds={summarizedCardIds}
                    onScrollToBlock={scrollToBlock}
                    unitName={unitName}
                    isOpen={isInnerSidebarOpen}
                    onClose={() => setIsInnerSidebarOpen(false)}
                />

                {/* Área de Tarjetas con Scroll Vertical Independiente */}
                <main className="flex-1 h-full overflow-y-auto p-4 sm:p-6 md:p-10 custom-scrollbar">
                    <div className="max-w-4xl mx-auto">
                        <div className="mb-6 md:mb-10 text-center">
                            <span className="text-[10px] sm:text-xs font-bold text-medical-green-600 bg-medical-green-50 px-3 py-1 rounded-full uppercase tracking-widest break-words block max-w-fit mx-auto">
                                {moduleName || 'Módulo'}
                            </span>
                            <h1 
                                className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 mt-4 tracking-tight break-words"
                                style={{ wordBreak: 'break-word', hyphens: 'auto' }}
                                lang="es"
                            >
                                {unitName || 'Lección'}
                            </h1>
                        </div>

                        {blocks.map((block, index) => {
                            const isCompleted = completedCardIds.includes(String(block.id)) || completedCardIds.includes(block.id as any);
                            const isTesting = activeTestingCardId === block.id;
                            const isSummarized = summarizedCardIds.includes(String(block.id));
                            const isHighlightMode = highlightModeCardId === block.id;
                            const highlightsCount = cardHighlights[block.id]?.length || 0;

                            return (
                                <LessonCard
                                    key={block.id}
                                    block={block}
                                    index={index}
                                    isCompleted={isCompleted}
                                    isTesting={isTesting}
                                    isSummarized={isSummarized}
                                    isHighlightMode={isHighlightMode}
                                    cardHighlightsCount={highlightsCount}
                                    cardRef={(el) => { cardRefs.current[block.id] = el; }}
                                    contentRef={(el) => { contentRefs.current[block.id] = el; }}
                                    onStartTest={handleStartTest}
                                    onSummarize={handleSummarize}
                                    onToggleHighlightMode={handleHighlightToggle}
                                    onClearHighlights={(id) => clearCardHighlights(String(id))}
                                    onContentMouseUp={handleContentMouseUp}
                                />
                            );
                        })}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default LessonContentViewer;
