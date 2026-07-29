'use client';

import React from 'react';
import { useQuizStore } from '../../store/quizStore';
import DifficultySelector from './DifficultySelector';
import { BookOpen, Check } from 'lucide-react';
import AIStudyButton from '../AIStudyButton';

const SubjectSelector = ({ modules, onGenerate }: { modules: any[]; onGenerate: () => void }) => {
    const { selectedTopics, toggleTopic, difficulty, mode, setMode, numQuestions, setNumQuestions } = useQuizStore();

    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50 custom-scrollbar">
            <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">Configuración de Evaluación</h1>
                        <p className="text-slate-500 text-xs md:text-sm mt-1">Selecciona las unidades didácticas que deseas repasar. El "Cerebro" leerá los documentos originales y generará un examen adaptado a tu selección.</p>
                    </div>
                    <AIStudyButton />
                </header>

                {/* Controles Globales Responsivos */}
                <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 md:gap-8 items-stretch md:items-center justify-between">
                    <div className="flex flex-wrap gap-4 md:gap-8 items-center justify-between md:justify-start">
                        <DifficultySelector />
                        
                        {/* Selector de Número de Preguntas (10, 20, 30) */}
                        <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nº Preguntas</span>
                            <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                                {[10, 20, 30].map((num) => (
                                    <button
                                        key={num}
                                        onClick={() => setNumQuestions(num)}
                                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all touch-target ${
                                            numQuestions === num
                                                ? 'bg-medical-green-500 text-white shadow-sm'
                                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                        }`}
                                    >
                                        {num}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Selector de Modo */}
                        <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Modo de Evaluación</span>
                            <div className="flex bg-slate-100 rounded-lg p-1">
                                <button 
                                    onClick={() => setMode('practice')}
                                    className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all touch-target ${mode === 'practice' ? 'bg-white shadow-sm text-medical-green-600' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Práctica
                                </button>
                                <button 
                                    onClick={() => setMode('exam')}
                                    className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all touch-target ${mode === 'exam' ? 'bg-white shadow-sm text-red-600' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Simulacro
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <button 
                        onClick={onGenerate}
                        disabled={selectedTopics.length === 0}
                        className={`w-full md:w-auto text-xs font-bold py-4 px-8 rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 shadow-xl ${
                            selectedTopics.length === 0 
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200' 
                                : 'bg-medical-green-600 text-white hover:bg-medical-green-700 shadow-medical-green-600/20 group animate-in zoom-in duration-500'
                        }`}
                    >
                        <div className={`w-5 h-5 rounded-lg flex items-center justify-center transition-colors ${selectedTopics.length === 0 ? 'bg-slate-200' : 'bg-medical-green-500 group-hover:bg-medical-green-400'}`}>
                            <Check className="w-3 h-3 text-white" />
                        </div>
                        <span className="uppercase tracking-widest">Generar ({numQuestions} Preguntas)</span>
                    </button>
                </div>

                {/* Grid de Asignaturas Responsivo */}
                <div className="space-y-4 md:space-y-6">
                    <h2 className="text-xs md:text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Currículo Disponible</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        {modules.map((mod: any) => (
                            <div key={mod.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center gap-3">
                                    <BookOpen className="w-4 h-4 text-slate-400" />
                                    <h3 className="font-bold text-slate-700 text-sm">{mod.name}</h3>
                                </div>
                                <div className="divide-y divide-slate-50">
                                    {mod.units.map((unit: any) => {
                                        const uniqueId = `${mod.id}/${unit.slug}`;
                                        const isSelected = selectedTopics.includes(uniqueId);
                                        return (
                                            <label 
                                                key={uniqueId}
                                                className={`flex items-start gap-3 p-3.5 cursor-pointer transition-colors group touch-target ${isSelected ? 'bg-medical-green-50/30' : 'hover:bg-slate-50'}`}
                                            >
                                                <div className="pt-0.5">
                                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-medical-green-500 border-medical-green-500' : 'border-slate-300 bg-white group-hover:border-medical-green-400'}`}>
                                                        {isSelected && <Check className="w-3 h-3 text-white" />}
                                                    </div>
                                                </div>
                                                <input 
                                                    type="checkbox" 
                                                    className="sr-only"
                                                    checked={isSelected}
                                                    onChange={() => toggleTopic(uniqueId)}
                                                />
                                                <div className="flex-1">
                                                    <p className={`text-xs md:text-sm font-medium transition-colors line-clamp-2 ${isSelected ? 'text-medical-green-900' : 'text-slate-600 group-hover:text-slate-800'}`}>
                                                        {unit.nombre.replace(/\.(pdf|docx)$/i, '')}
                                                    </p>
                                                    {unit.completado && (
                                                        <span className="text-[10px] text-medical-green-600 font-bold uppercase tracking-wider">Leído</span>
                                                    )}
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SubjectSelector;
