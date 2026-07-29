import React from 'react';
import { LessonBlock } from '../hooks/useLessonCards';
import { CheckCircle, Sparkles } from 'lucide-react';

interface LessonTocSidebarProps {
    blocks: LessonBlock[];
    completedCardIds: string[];
    activeTestingCardId: string | null;
    summarizedCardIds: string[];
    onScrollToBlock: (id: string | number) => void;
    unitName?: string;
    isOpen: boolean;
}

export const LessonTocSidebar: React.FC<LessonTocSidebarProps> = ({
    blocks,
    completedCardIds,
    activeTestingCardId,
    summarizedCardIds,
    onScrollToBlock,
    unitName,
    isOpen
}) => {
    if (!isOpen) return null;

    return (
        <aside 
            className="w-[280px] shrink-0 h-full bg-white border-r border-slate-200 flex flex-col shadow-sm z-20 animate-in slide-in-from-left duration-300"
        >
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Navegación de Lección</span>
                <h2 className="text-xs font-bold text-slate-800 mt-1 truncate">{unitName || 'Contenido'}</h2>
                <span className="text-[10px] text-slate-400 font-medium">{blocks.length} Tarjetas</span>
            </div>
            
            <nav className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
                {blocks.map((b, idx) => {
                    const isCompleted = completedCardIds.includes(String(b.id)) || completedCardIds.includes(b.id as any);
                    const isTesting = activeTestingCardId === b.id;
                    const isSummarized = summarizedCardIds.includes(String(b.id));

                    return (
                        <button
                            key={b.id}
                            onClick={() => onScrollToBlock(b.id)}
                            className={`w-full text-left p-3 rounded-xl border text-xs font-medium transition-all flex items-center justify-between group ${
                                isTesting
                                    ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold ring-1 ring-amber-400/20'
                                    : isCompleted
                                    ? 'bg-medical-green-50/80 border-medical-green-200 text-medical-green-900 font-bold'
                                    : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50 hover:border-slate-200'
                            }`}
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <span className={`text-[10px] font-bold w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                                    isCompleted ? 'bg-medical-green-500 text-white' : 'bg-slate-100 text-slate-500'
                                }`}>
                                    {idx + 1}
                                </span>
                                <span className="truncate leading-tight text-xs">{b.titulo}</span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0 ml-1">
                                {isSummarized && (
                                    <span title="Resumida con IA">
                                        <Sparkles size={12} className="text-blue-500" />
                                    </span>
                                )}
                                {isCompleted && (
                                    <CheckCircle size={14} className="text-medical-green-600" />
                                )}
                            </div>
                        </button>
                    );
                })}
            </nav>
        </aside>
    );
};
