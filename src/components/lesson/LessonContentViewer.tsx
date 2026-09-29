"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useUIStore } from "../../store/uiStore";
import { useChatStore } from "../../store/chatStore";
import { useLessonCards, LessonBlock } from "./hooks/useLessonCards";
import { useTextHighlighter } from "./hooks/useTextHighlighter";
import { LessonTocSidebar } from "./components/LessonTocSidebar";
import { LessonCard } from "./components/LessonCard";
import { PdfSyncViewerModal } from "../pdf/PdfSyncViewerModal";
import { supabase } from "../../lib/supabase";
import { trackEvent } from "../../lib/tracking";
import { 
    CheckCircle, 
    PanelLeftClose, 
    PanelLeftOpen, 
    ChevronLeft, 
    ChevronRight, 
    LayoutList, 
    Square, 
    Sparkles,
    FileText
} from "lucide-react";

export interface LessonContentViewerProps {
    docId?: string;
    unitName?: string;
    moduleName?: string;
    pdfUrl?: string;
}

const LessonContentViewer: React.FC<LessonContentViewerProps> = ({ docId, unitName, moduleName, pdfUrl }) => {
    const { isLeftSidebarOpen } = useUIStore();
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
    const [activeIndex, setActiveIndex] = useState(0);
    const [viewMode, setViewMode] = useState<"single" | "all">("single");
    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
    
    const cardRefs = useRef<Record<string | number, HTMLElement | null>>({});
    const mainScrollRef = useRef<HTMLElement | null>(null);

    // Keyboard navigation between cards (Left/Right arrows)
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (["input", "textarea"].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) return;
        if (e.key === "ArrowRight") {
            setActiveIndex((prev) => Math.min(blocks.length - 1, prev + 1));
        } else if (e.key === "ArrowLeft") {
            setActiveIndex((prev) => Math.max(0, prev - 1));
        }
    }, [blocks.length]);

    useEffect(() => {
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown]);

    // Check completion status of unit
    useEffect(() => {
        const checkUnitCompletion = async () => {
            if (!docId) return;
            const { data: { session } } = await supabase.auth.getSession();
            const currentUserId = session?.user?.id || "anonymous_user";

            const { data } = await supabase
                .schema("nutricionista")
                .from("pasos_completados")
                .select("completado")
                .eq("user_id", currentUserId)
                .eq("documento_id", docId)
                .eq("paso_id", 9999)
                .single();

            if (data?.completado) setIsCompletedUnit(true);
        };
        checkUnitCompletion();
    }, [docId]);

    const handleSelectBlock = (index: number) => {
        setActiveIndex(index);
        if (viewMode === "all") {
            const targetBlock = blocks[index];
            if (targetBlock && cardRefs.current[targetBlock.id]) {
                cardRefs.current[targetBlock.id]?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        } else {
            mainScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    const handleToggleCompleteUnit = async () => {
        const newStatus = !isCompletedUnit;
        setIsCompletedUnit(newStatus);

        const { data: { session } } = await supabase.auth.getSession();
        const currentUserId = session?.user?.id || "anonymous_user";

        if (docId) {
            await supabase.schema("nutricionista").from("pasos_completados").upsert({
                user_id: currentUserId,
                documento_id: docId,
                paso_id: 9999,
                completado: newStatus,
                actualizado_en: new Date().toISOString()
            });

            trackEvent(newStatus ? "unit_completed" : "unit_uncompleted", {
                category: "Progreso",
                docId,
                unitName
            });
        }
    };

    const handleStartTest = (block: LessonBlock) => {
        useChatStore.getState().setActiveTestingCardId(String(block.id));
        const prompt = `Por favor, genera un mini-test adaptativo de 3 preguntas de opción múltiple basado exclusivamente en el siguiente contenido:\n\n### ${block.titulo}\n${block.contenido}`;
        sendMessage(prompt, { isTestRequest: true, targetBlockId: String(block.id), blockContent: block.contenido, current_slug: unitName });
    };

    const handleSummarize = (block: LessonBlock) => {
        useChatStore.getState().markCardSummarized(String(block.id));
        const prompt = `Por favor, elabora un resumen ejecutivo de alta densidad y puntos clave de la siguiente tarjeta:\n\n### ${block.titulo}\n${block.contenido}`;
        sendMessage(prompt, { isTestRequest: false, targetBlockId: String(block.id), blockContent: block.contenido, current_slug: unitName });
    };

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-4 bg-slate-50">
                <div className="w-12 h-12 border-4 border-slate-200 border-t-medical-green-500 rounded-full animate-spin" />
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest animate-pulse">
                    Cargando lección...
                </p>
            </div>
        );
    }

    if (blocks.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50">
                <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mb-3">
                    <LayoutList size={28} />
                </div>
                <h3 className="text-base font-bold text-slate-800">Esta lección aún no tiene tarjetas configuradas</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    El documento está registrado, pero su contenido aún no ha sido segmentado en tarjetas.
                </p>
            </div>
        );
    }

    const currentBlock = blocks[activeIndex] || blocks[0];
    const progressPercent = Math.round(((activeIndex + 1) / blocks.length) * 100);

    return (
        <div className="flex flex-col flex-1 h-full w-full overflow-hidden bg-slate-100/50">
            {/* Barra de Controles Superior */}
            <div className="bg-white border-b border-slate-200/80 px-4 py-2.5 flex items-center justify-between gap-3 shrink-0 shadow-2xs select-none">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsInnerSidebarOpen(!isInnerSidebarOpen)}
                        className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all flex items-center gap-1.5 text-xs font-bold"
                        title={isInnerSidebarOpen ? "Ocultar Índice" : "Mostrar Índice"}
                    >
                        {isInnerSidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
                        <span className="hidden sm:inline">Índice</span>
                    </button>

                    {/* Selector de Modo: 1 a 1 vs Continuo */}
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                        <button
                            onClick={() => setViewMode("single")}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                viewMode === "single"
                                    ? "bg-white text-slate-900 shadow-2xs"
                                    : "text-slate-500 hover:text-slate-800"
                            }`}
                            title="Modo On-Demand: 1 tarjeta a la vez"
                        >
                            <Square size={13} />
                            <span className="hidden md:inline">1 a 1</span>
                        </button>
                        <button
                            onClick={() => setViewMode("all")}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                viewMode === "all"
                                    ? "bg-white text-slate-900 shadow-2xs"
                                    : "text-slate-500 hover:text-slate-800"
                            }`}
                            title="Modo Continuo: Ver todas las tarjetas seguidas"
                        >
                            <LayoutList size={13} />
                            <span className="hidden md:inline">Todas</span>
                        </button>
                    </div>
                </div>

                {/* Indicador Central de Tarjetas */}
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700">
                        Tarjeta <strong className="text-slate-900">{activeIndex + 1}</strong> de {blocks.length}
                    </span>
                    <span className="text-[11px] font-bold text-medical-green-700 bg-medical-green-50 border border-medical-green-200 px-2 py-0.5 rounded-full">
                        {progressPercent}%
                    </span>
                </div>

                {/* Acciones Derecha */}
                <div className="flex items-center gap-2">
                    {pdfUrl && (
                        <button
                            onClick={() => setIsPdfModalOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 hover:border-sky-300 hover:bg-sky-50 text-slate-700 hover:text-sky-700 transition-all shadow-2xs"
                            title="Abrir visor PDF sincronizado con la tarjeta actual"
                        >
                            <FileText size={14} className="text-sky-500" />
                            <span className="hidden sm:inline">PDF Sincronizado</span>
                        </button>
                    )}

                    <button
                        onClick={handleToggleCompleteUnit}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs ${
                            isCompletedUnit
                                ? "bg-medical-green-500 text-white shadow-medical-green-200"
                                : "bg-slate-900 hover:bg-slate-800 text-white"
                        }`}
                    >
                        <CheckCircle size={14} />
                        <span className="hidden sm:inline">{isCompletedUnit ? "Completada" : "Marcar Completada"}</span>
                    </button>
                </div>
            </div>

            {/* Barra de Progreso Superior */}
            <div className="w-full h-1 bg-slate-200/80 shrink-0">
                <div 
                    className="h-full bg-medical-green-500 transition-all duration-300 ease-out"
                    style={{ width: `${progressPercent}%` }}
                />
            </div>

            {/* Layout Horizontal: Sidebar Vertical Izquierdo + Área de Tarjetas */}
            <div className="flex flex-1 w-full h-full overflow-hidden">
                {/* Índice Lateral Izquierdo */}
                <LessonTocSidebar
                    blocks={blocks}
                    activeIndex={activeIndex}
                    completedCardIds={completedCardIds}
                    activeTestingCardId={activeTestingCardId}
                    summarizedCardIds={summarizedCardIds}
                    onSelectBlock={handleSelectBlock}
                    unitName={unitName}
                    isOpen={isInnerSidebarOpen}
                    onClose={() => setIsInnerSidebarOpen(false)}
                />

                {/* Área de Visualización */}
                <main 
                    ref={mainScrollRef}
                    className="flex-1 h-full overflow-y-auto p-3 sm:p-6 md:p-8 custom-scrollbar"
                >
                    <div className="max-w-4xl mx-auto">
                        <div className="mb-5 text-center">
                            <span className="text-[10px] sm:text-xs font-bold text-medical-green-600 bg-medical-green-50 px-3 py-1 rounded-full uppercase tracking-widest inline-block">
                                {moduleName || "Módulo"}
                            </span>
                            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 mt-2 tracking-tight break-words">
                                {unitName || "Lección"}
                            </h1>
                        </div>

                        {viewMode === "single" ? (
                            /* Modo On-Demand 1 a 1 */
                            <div className="space-y-4">
                                <LessonCard
                                    key={currentBlock.id}
                                    block={currentBlock}
                                    index={activeIndex}
                                    isCompleted={completedCardIds.includes(String(currentBlock.id))}
                                    isTesting={activeTestingCardId === currentBlock.id}
                                    isSummarized={summarizedCardIds.includes(String(currentBlock.id))}
                                    isHighlightMode={highlightModeCardId === currentBlock.id}
                                    cardHighlightsCount={cardHighlights[currentBlock.id]?.length || 0}
                                    cardRef={(el) => { cardRefs.current[currentBlock.id] = el; }}
                                    contentRef={(el) => { contentRefs.current[currentBlock.id] = el; }}
                                    onStartTest={handleStartTest}
                                    onSummarize={handleSummarize}
                                    onToggleHighlightMode={handleHighlightToggle}
                                    onClearHighlights={(id) => clearCardHighlights(String(id))}
                                    onContentMouseUp={handleContentMouseUp}
                                    onOpenPdfViewer={() => setIsPdfModalOpen(true)}
                                    hasPdf={!!pdfUrl}
                                />

                                {/* Barra de Navegación Inferior */}
                                <div className="flex items-center justify-between bg-white border border-slate-200/80 p-3 sm:p-4 rounded-2xl shadow-sm select-none">
                                    <button
                                        onClick={() => setActiveIndex((p) => Math.max(0, p - 1))}
                                        disabled={activeIndex === 0}
                                        className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-all"
                                    >
                                        <ChevronLeft size={16} />
                                        <span>Anterior</span>
                                    </button>

                                    <div className="text-center">
                                        <div className="text-xs font-black text-slate-800">
                                            Tarjeta {activeIndex + 1} de {blocks.length}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-medium hidden sm:block">
                                            (Usa las teclas ← y → del teclado)
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setActiveIndex((p) => Math.min(blocks.length - 1, p + 1))}
                                        disabled={activeIndex === blocks.length - 1}
                                        className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-30 disabled:pointer-events-none transition-all shadow-sm"
                                    >
                                        <span>Siguiente</span>
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Modo Continuo */
                            <div>
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
                                            onOpenPdfViewer={() => {
                                                setActiveIndex(index);
                                                setIsPdfModalOpen(true);
                                            }}
                                            hasPdf={!!pdfUrl}
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {/* Modal de Visor PDF Sincronizado */}
            <PdfSyncViewerModal
                isOpen={isPdfModalOpen}
                onClose={() => setIsPdfModalOpen(false)}
                pdfUrl={pdfUrl}
                unitName={unitName}
                activeBlock={currentBlock}
                activeCardIndex={activeIndex}
                totalCards={blocks.length}
                onPrevCard={() => setActiveIndex((p) => Math.max(0, p - 1))}
                onNextCard={() => setActiveIndex((p) => Math.min(blocks.length - 1, p + 1))}
            />
        </div>
    );
};

export default LessonContentViewer;
