import React from "react";
import ReactMarkdown from "react-markdown";
import { LessonBlock } from "../hooks/useLessonCards";
import { CodeBlock } from "./CodeBlock";
import { defaultRemarkPlugins, defaultRehypePlugins } from "@/lib/markdownPlugins";
import { normalizeCardContent } from "@/lib/codeFormatter";
import { Brain, CheckCircle, Highlighter, FileText } from "lucide-react";

interface LessonCardProps {
    block: LessonBlock;
    index: number;
    isCompleted: boolean;
    isTesting: boolean;
    isSummarized: boolean;
    isHighlightMode: boolean;
    cardHighlightsCount: number;
    cardRef?: (el: HTMLElement | null) => void;
    contentRef?: (el: HTMLElement | null) => void;
    onStartTest: (block: LessonBlock) => void;
    onSummarize: (block: LessonBlock) => void;
    onToggleHighlightMode: (blockId: string | number) => void;
    onClearHighlights: (blockId: string | number) => void;
    onContentMouseUp: (block: LessonBlock, e: React.MouseEvent<HTMLDivElement>) => void;
    onOpenPdfViewer?: () => void;
    hasPdf?: boolean;
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
    onOpenPdfViewer,
    hasPdf = false,
}) => {
    const isIndexCard = block.titulo.toLowerCase().includes("indice") || block.titulo.toLowerCase().includes("índice");
    const normalizedContent = normalizeCardContent(block.contenido);

    return (
        <section
            ref={cardRef}
            className={`bg-white rounded-2xl sm:rounded-3xl border mb-6 sm:mb-10 overflow-hidden transition-all duration-300 shadow-xl group/card ${
                isCompleted
                    ? "border-medical-green-400 shadow-medical-green-200/30"
                    : isTesting
                    ? "border-amber-400 ring-2 ring-amber-400/20 shadow-amber-200/30"
                    : "border-slate-100 hover:border-slate-200 shadow-slate-200/50"
            }`}
        >
            {/* Header de la Tarjeta */}
            <div className="px-4 py-3.5 sm:px-8 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100/80 bg-slate-50/70 min-w-0">
                <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                    <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl font-black text-xs flex items-center justify-center shadow-md shrink-0 mt-0.5 sm:mt-0 bg-slate-900 text-white">
                        {index + 1}
                    </span>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight break-words min-w-0 flex-1">
                        {block.titulo}
                    </h2>
                </div>

                <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 shrink-0 self-start sm:self-auto">
                    {isCompleted && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold bg-medical-green-100 text-medical-green-700 whitespace-nowrap">
                            <CheckCircle size={13} />
                            Completada
                        </span>
                    )}

                    {/* Botón Ver en PDF Original Sincronizado */}
                    {hasPdf && onOpenPdfViewer && (
                        <button
                            onClick={onOpenPdfViewer}
                            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50 text-slate-700 hover:text-sky-700 shadow-2xs transition-all whitespace-nowrap shrink-0"
                            title="Ver este fragmento resaltado en el PDF original"
                        >
                            <FileText size={13} className="text-sky-500" />
                            <span>Ver en PDF</span>
                        </button>
                    )}

                    {/* Botón Mini-Test */}
                    {!isIndexCard && (
                        <button
                            onClick={() => onStartTest(block)}
                            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm whitespace-nowrap shrink-0 ${
                                isTesting
                                    ? "bg-amber-500 text-white animate-pulse"
                                    : "bg-medical-green-500 hover:bg-medical-green-600 text-white"
                            }`}
                            title="Generar mini-test adaptativo de esta tarjeta"
                        >
                            <Brain size={14} className="shrink-0" />
                            <span>{isTesting ? "Evaluando..." : "Mini-Test"}</span>
                        </button>
                    )}

                    {/* Botón Resumir */}
                    {!isIndexCard && (
                        <button
                            onClick={() => onSummarize(block)}
                            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold border transition-all whitespace-nowrap shrink-0 ${
                                isSummarized
                                    ? "bg-blue-50 border-blue-200 text-blue-700"
                                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                            }`}
                            title="Resumir esta tarjeta con IA"
                        >
                            <span>{isSummarized ? "✓ Resumida" : "Resumir"}</span>
                        </button>
                    )}

                    {/* Botón Subrayar Manual */}
                    <button
                        onClick={() => onToggleHighlightMode(block.id)}
                        className={`p-1.5 rounded-xl border text-xs font-bold transition-all shrink-0 ${
                            isHighlightMode
                                ? "bg-amber-100 border-amber-300 text-amber-800 ring-2 ring-amber-400/30"
                                : "bg-white border-slate-200 text-slate-500 hover:text-slate-700"
                        }`}
                        title={isHighlightMode ? "Modo subrayado activo: selecciona texto" : "Activar subrayado manual"}
                    >
                        <Highlighter size={14} />
                    </button>

                    {cardHighlightsCount > 0 && (
                        <button
                            onClick={() => onClearHighlights(block.id)}
                            className="text-[10px] text-slate-400 hover:text-red-500 underline ml-1"
                        >
                            Limpiar
                        </button>
                    )}
                </div>
            </div>

            {/* Contenido de la Tarjeta con Formato Justificado y Tipografía Pulida */}
            <div
                ref={contentRef}
                onMouseUp={(e) => onContentMouseUp(block, e)}
                className={`p-4 sm:p-8 max-w-none prose prose-slate text-justify [text-align-last:left] hyphens-auto prose-p:text-justify prose-p:leading-relaxed prose-headings:font-bold prose-headings:text-left prose-h3:text-slate-900 prose-h3:text-base prose-h3:mt-5 prose-h3:mb-2 prose-h4:text-slate-800 prose-strong:text-slate-900 prose-strong:font-bold prose-li:my-1 text-slate-800 ${
                    isHighlightMode ? "cursor-text selection:bg-yellow-200" : ""
                }`}
            >
                <ReactMarkdown
                    remarkPlugins={defaultRemarkPlugins}
                    rehypePlugins={defaultRehypePlugins}
                    components={{
                        code({ node, inline, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || "");
                            const codeString = String(children).replace(/\n$/, "");
                            const isInline = inline || (!className && !codeString.includes("\n"));
                            
                            if (isInline) {
                                return (
                                    <code
                                        className="bg-sky-50 text-sky-800 border border-sky-200/70 font-mono text-[11px] sm:text-xs px-1.5 py-0.5 rounded font-semibold whitespace-nowrap mx-0.5 not-prose inline-block"
                                        {...props}
                                    >
                                        {children}
                                    </code>
                                );
                            }

                            const lang = match ? match[1] : "código";
                            return (
                                <CodeBlock
                                    language={lang}
                                    value={codeString}
                                />
                            );
                        }
                    }}
                >
                    {normalizedContent}
                </ReactMarkdown>
            </div>
        </section>
    );
};
