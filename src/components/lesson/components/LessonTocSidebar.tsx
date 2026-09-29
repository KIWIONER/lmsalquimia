import React from "react";
import Link from "next/link";
import { LessonBlock } from "../hooks/useLessonCards";
import { CheckCircle, Sparkles, X, ArrowLeft, Library, Code2 } from "lucide-react";
import { isProgrammingCard } from "@/lib/codeFormatter";

interface LessonTocSidebarProps {
    blocks: LessonBlock[];
    activeIndex: number;
    completedCardIds: string[];
    activeTestingCardId: string | null;
    summarizedCardIds: string[];
    onSelectBlock: (index: number) => void;
    unitName?: string;
    isOpen: boolean;
    onClose?: () => void;
}

export const LessonTocSidebar: React.FC<LessonTocSidebarProps> = ({
    blocks,
    activeIndex,
    completedCardIds,
    activeTestingCardId,
    summarizedCardIds,
    onSelectBlock,
    unitName,
    isOpen,
    onClose
}) => {
    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop para móviles */}
            <div 
                onClick={onClose}
                className="md:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 animate-in fade-in duration-200"
            />

            <aside 
                className="fixed md:relative inset-y-0 left-0 w-[290px] shrink-0 h-full bg-white border-r border-slate-200 flex flex-col shadow-xl md:shadow-sm z-50 md:z-20 animate-in slide-in-from-left duration-300 select-none"
            >
                {/* Regresar a Asignaturas */}
                <div className="p-3 border-b border-slate-100 bg-slate-50/80">
                    <Link
                        href="/biblioteca"
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:border-medical-green-400 hover:text-medical-green-700 shadow-2xs hover:shadow-xs transition-all group"
                    >
                        <div className="flex items-center gap-2">
                            <ArrowLeft size={14} className="text-slate-400 group-hover:text-medical-green-600 transition-colors" />
                            <span>Volver a Asignaturas</span>
                        </div>
                        <Library size={14} className="text-slate-400 group-hover:text-medical-green-600 transition-colors" />
                    </Link>
                </div>

                {/* Encabezado del Índice */}
                <div className="p-4 border-b border-slate-100 bg-white flex items-center justify-between">
                    <div className="min-w-0 flex-1 pr-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Índice de la Lección</span>
                        <h2 className="text-xs font-bold text-slate-800 mt-0.5 truncate">{unitName || "Contenido"}</h2>
                        <span className="text-[10px] text-slate-400 font-medium">{blocks.length} Tarjetas</span>
                    </div>
                    {onClose && (
                        <button 
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            title="Cerrar índice"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                {/* Lista de Tarjetas On-Demand */}
                <nav className="flex-1 overflow-y-auto p-2.5 space-y-1.5 custom-scrollbar">
                    {blocks.map((b, idx) => {
                        const isCompleted = completedCardIds.includes(String(b.id)) || completedCardIds.includes(b.id as any);
                        const isTesting = activeTestingCardId === b.id;
                        const isSummarized = summarizedCardIds.includes(String(b.id));
                        const isActive = activeIndex === idx;
                        const isCode = isProgrammingCard(b.titulo, b.contenido);

                        return (
                            <button
                                key={b.id || idx}
                                onClick={() => {
                                    onSelectBlock(idx);
                                    if (onClose && window.innerWidth < 768) onClose();
                                }}
                                className={`w-full text-left p-2.5 rounded-xl border text-xs font-medium transition-all flex items-center justify-between group ${
                                    isActive
                                        ? "bg-slate-900 border-slate-900 text-white shadow-md ring-2 ring-slate-900/20 font-bold"
                                        : isTesting
                                        ? "bg-amber-50 border-amber-300 text-amber-900 font-bold"
                                        : isCompleted
                                        ? "bg-medical-green-50/80 border-medical-green-200 text-medical-green-900 font-semibold"
                                        : "bg-white border-slate-100 text-slate-700 hover:bg-slate-50 hover:border-slate-200"
                                }`}
                            >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <span className={`text-[10px] font-bold w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                                        isActive
                                            ? "bg-sky-400 text-slate-950 font-black"
                                            : isCompleted
                                            ? "bg-medical-green-500 text-white"
                                            : "bg-slate-100 text-slate-600"
                                    }`}>
                                        {idx + 1}
                                    </span>
                                    <span className="truncate leading-tight text-xs flex-1">{b.titulo}</span>
                                </div>

                                <div className="flex items-center gap-1 shrink-0 ml-1.5">
                                    {isCode && (
                                        <span title="Contiene código"><Code2 size={12} className={isActive ? "text-sky-400" : "text-slate-400"} /></span>
                                    )}
                                    {isSummarized && (
                                        <span title="Resumida con IA"><Sparkles size={12} className={isActive ? "text-sky-300" : "text-blue-500"} /></span>
                                    )}
                                    {isCompleted && (
                                        <CheckCircle size={13} className={isActive ? "text-emerald-300" : "text-medical-green-600"} />
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </nav>
            </aside>
        </>
    );
};
