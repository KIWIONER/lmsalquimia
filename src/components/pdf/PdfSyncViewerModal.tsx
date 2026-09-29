"use client";

import React, { useState } from "react";
import { 
    X, 
    ChevronLeft, 
    ChevronRight, 
    ExternalLink, 
    FileText, 
    Maximize2, 
    Minimize2
} from "lucide-react";
import { LessonBlock } from "../lesson/hooks/useLessonCards";
import { PdfCanvasViewer } from "./PdfCanvasViewer";

interface PdfSyncViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    pdfUrl?: string;
    unitName?: string;
    activeBlock?: LessonBlock;
    activeCardIndex?: number;
    totalCards?: number;
    onPrevCard?: () => void;
    onNextCard?: () => void;
}

export const PdfSyncViewerModal: React.FC<PdfSyncViewerModalProps> = ({
    isOpen,
    onClose,
    pdfUrl,
    unitName,
    activeBlock,
    activeCardIndex = 0,
    totalCards = 0,
    onPrevCard,
    onNextCard
}) => {
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [enableHighlight, setEnableHighlight] = useState<boolean>(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("alquimia_pdf_sync_enabled");
            return saved === "true";
        }
        return false;
    });

    const toggleHighlight = () => {
        setEnableHighlight(prev => {
            const next = !prev;
            if (typeof window !== "undefined") {
                localStorage.setItem("alquimia_pdf_sync_enabled", String(next));
            }
            return next;
        });
    };

    if (!isOpen || !pdfUrl) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200 p-2 sm:p-4 md:p-6">
            <div 
                className={`bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-700 transition-all duration-300 ${
                    isFullScreen ? "w-full h-full rounded-none" : "w-full max-w-6xl h-[92vh]"
                }`}
            >
                {/* Header del Visor PDF Sincronizado */}
                <header className="px-4 py-3 bg-slate-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                            <FileText size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-black text-emerald-400 uppercase tracking-wider truncate">
                                    {unitName || "Documento Original PDF"}
                                </span>
                                {totalCards > 0 && (
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold border border-slate-700">
                                        Tarjeta {activeCardIndex + 1} de {totalCards}
                                    </span>
                                )}
                            </div>
                            <h3 className="text-sm font-bold text-white truncate mt-0.5">
                                {activeBlock?.titulo || "Visor Sincronizado"}
                            </h3>
                        </div>
                    </div>

                    {/* Botón de encendido / apagado de sincronización */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleHighlight}
                            className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all flex items-center gap-1.5 ${
                                enableHighlight
                                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 shadow-sm"
                                    : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                            }`}
                            title={enableHighlight ? "Desactivar resaltado automático en PDF" : "Activar resaltado automático en PDF"}
                        >
                            <div className={`w-2 h-2 rounded-full ${enableHighlight ? "bg-emerald-400 shadow-[0_0_6px_#10b981]" : "bg-slate-500"}`} />
                            <span>{enableHighlight ? "Sincronizado: ON" : "Sincronizado: OFF"}</span>
                        </button>
                    </div>

                    {/* Controles de Navegación de Tarjeta */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        {onPrevCard && onNextCard && (
                            <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
                                <button
                                    onClick={onPrevCard}
                                    disabled={activeCardIndex <= 0}
                                    className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                                    title="Tarjeta anterior"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <span className="text-xs font-mono font-bold px-1.5 text-slate-300">
                                    {activeCardIndex + 1}/{totalCards}
                                </span>
                                <button
                                    onClick={onNextCard}
                                    disabled={activeCardIndex >= totalCards - 1}
                                    className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                                    title="Tarjeta siguiente"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        )}

                        <button
                            onClick={() => setIsFullScreen(!isFullScreen)}
                            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            title={isFullScreen ? "Pantalla normal" : "Pantalla completa"}
                        >
                            {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>

                        <a
                            href={pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            title="Abrir PDF en pestaña nueva"
                        >
                            <ExternalLink size={16} />
                        </a>

                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                            title="Cerrar visor"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </header>

                {/* Visor PDF Canvas de alta fidelidad con recuadro verde de 3px y sin pestañeo */}
                <div className="flex-1 w-full h-full relative overflow-hidden bg-slate-900">
                    <PdfCanvasViewer
                        pdfUrl={pdfUrl}
                        cardTitle={activeBlock?.titulo || ""}
                        cardContent={activeBlock?.contenido || ""}
                        cardIndex={activeCardIndex}
                        enableHighlight={enableHighlight}
                        onToggleHighlight={toggleHighlight}
                        className="w-full h-full"
                    />
                </div>
            </div>
        </div>
    );
};
