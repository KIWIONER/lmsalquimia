import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';
import { LessonBlock } from '../hooks/useLessonCards';
import { Brain, CheckCircle, Highlighter } from 'lucide-react';

interface LessonCardProps {
    block: LessonBlock;
    index: number;
    isCompleted: boolean;
    isTesting: boolean;
    isSummarized: boolean;
    isHighlightMode: boolean;
    cardHighlightsCount: number;
    cardRef: (el: HTMLElement | null) => void;
    contentRef: (el: HTMLElement | null) => void;
    onStartTest: (block: LessonBlock) => void;
    onSummarize: (block: LessonBlock) => void;
    onToggleHighlightMode: (blockId: string | number) => void;
    onClearHighlights: (blockId: string | number) => void;
    onContentMouseUp: (block: LessonBlock, e: React.MouseEvent<HTMLDivElement>) => void;
}

export const LessonCard: React.FC<LessonCardProps> = ({
    block,
    index,
    isCompleted,
    isTesting,
    isSummarized,
    isHighlightMode,
    cardHighlightsCount,
    cardRef,
    contentRef,
    onStartTest,
    onSummarize,
    onToggleHighlightMode,
    onClearHighlights,
    onContentMouseUp,
}) => {
    const isIndexCard = block.titulo.toLowerCase().includes('indice') || block.titulo.toLowerCase().includes('índice');

    return (
        <section
            ref={cardRef}
            className={`bg-white rounded-[2.5rem] border mb-10 overflow-hidden transition-all duration-500 shadow-xl group/card ${
                isCompleted
                    ? 'border-medical-green-400 bg-medical-green-50/20 shadow-medical-green-200/40 order-1'
                    : isTesting
                    ? 'border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/10'
                    : 'border-slate-100 hover:border-slate-200 shadow-slate-200/50'
            }`}
        >
            {/* Header de la Tarjeta */}
            <div className="px-8 pt-8 pb-4 flex items-center justify-between border-b border-slate-100/60 bg-slate-50/50">
                <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-slate-900 text-white font-black text-xs flex items-center justify-center shadow-md">
                        {index + 1}
                    </span>
                    <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                        {block.titulo}
                    </h2>
                </div>

                <div className="flex items-center gap-2">
                    {isCompleted && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-medical-green-100 text-medical-green-700">
                            <CheckCircle size={14} />
                            Completada
                        </span>
                    )}

                    {/* Botón Mini-Test */}
                    {!isIndexCard && (
                        <button
                            onClick={() => onStartTest(block)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                                isTesting
                                    ? 'bg-amber-500 text-white animate-pulse'
                                    : 'bg-medical-green-500 hover:bg-medical-green-600 text-white'
                            }`}
                            title="Generar mini-test adaptativo de esta tarjeta"
                        >
                            <Brain size={14} />
                            <span>{isTesting ? 'Evaluando...' : 'Mini-Test'}</span>
                        </button>
                    )}

                    {/* Botón Resumir */}
                    {!isIndexCard && (
                        <button
                            onClick={() => onSummarize(block)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                isSummarized
                                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                            title="Resumir esta tarjeta con IA"
                        >
                            <span>{isSummarized ? '✓ Resumida' : 'Resumir'}</span>
                        </button>
                    )}

                    {/* Botón Subrayar Manual */}
                    <button
                        onClick={() => onToggleHighlightMode(block.id)}
                        className={`p-1.5 rounded-xl border text-xs font-bold transition-all ${
                            isHighlightMode
                                ? 'bg-amber-100 border-amber-300 text-amber-800 ring-2 ring-amber-400/30'
                                : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'
                        }`}
                        title={isHighlightMode ? 'Modo subrayado activo: selecciona texto' : 'Activar subrayado manual'}
                    >
                        <Highlighter size={14} />
                    </button>

                    {cardHighlightsCount > 0 && (
                        <button
                            onClick={() => onClearHighlights(block.id)}
                            className="text-[10px] text-slate-400 hover:text-red-500 underline"
                        >
                            Limpiar
                        </button>
                    )}
                </div>
            </div>

            {/* Contenido de la Tarjeta */}
            <div
                ref={contentRef}
                onMouseUp={(e) => onContentMouseUp(block, e)}
                className={`p-8 prose prose-slate max-w-none prose-p:leading-relaxed prose-headings:font-bold ${
                    isHighlightMode ? 'cursor-text selection:bg-yellow-200' : ''
                }`}
            >
                <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkBreaks]}
                    rehypePlugins={[rehypeRaw]}
                >
                    {block.contenido}
                </ReactMarkdown>
            </div>
        </section>
    );
};
