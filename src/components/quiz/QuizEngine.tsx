'use client';

import React, { useState } from 'react';
import { useQuizStore } from '../../store/quizStore';
import QuestionCard from './QuestionCard';
import ProgressBar from './ProgressBar';
import SubjectSelector from './SubjectSelector';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AIStudyButton from '../AIStudyButton';

const normalizeSingleQuestion = (q: any, idx: number) => {
    let answerIndex = 0;
    if (typeof q.correctAnswer === 'number') {
        answerIndex = Math.min(Math.max(0, Math.floor(q.correctAnswer)), 3);
    } else if (typeof q.correctAnswer === 'string') {
        const lower = q.correctAnswer.trim().toLowerCase();
        if (lower === 'a' || lower === '0') answerIndex = 0;
        else if (lower === 'b' || lower === '1') answerIndex = 1;
        else if (lower === 'c' || lower === '2') answerIndex = 2;
        else if (lower === 'd' || lower === '3') answerIndex = 3;
    }

    const rawOptions = Array.isArray(q.options) ? q.options : [];
    const options = rawOptions.length >= 2
        ? rawOptions.slice(0, 4).map((opt: any) => String(opt))
        : ['Opción A', 'Opción B', 'Opción C', 'Opción D'];

    while (options.length < 4) {
        options.push(`Opción ${String.fromCharCode(65 + options.length)}`);
    }

    return {
        id: String(q.id || `q-${idx + 1}`),
        text: String(q.text || q.pregunta || q.question || `Pregunta ${idx + 1}`),
        options,
        correctAnswer: answerIndex,
        rationale: String(q.rationale || q.explicacion || q.feedback || 'Explicación clínica orientada a la práctica profesional.'),
        hint: String(q.hint || q.pista || 'Revisa los conceptos clave de la unidad didáctica.')
    };
};

const extractAndNormalizeQuestions = (rawOutput: any): any[] => {
    if (!rawOutput) return [];

    if (Array.isArray(rawOutput)) {
        return rawOutput.map(normalizeSingleQuestion);
    }

    let jsonText = '';
    if (typeof rawOutput === 'object') {
        if (Array.isArray(rawOutput.questions)) return rawOutput.questions.map(normalizeSingleQuestion);
        if (Array.isArray(rawOutput.items)) return rawOutput.items.map(normalizeSingleQuestion);
        jsonText = rawOutput.output || rawOutput.response || rawOutput.text || JSON.stringify(rawOutput);
    } else if (typeof rawOutput === 'string') {
        jsonText = rawOutput;
    }

    const match = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || jsonText.match(/(\[\s*\{[\s\S]*\}\s*\])/);
    const candidate = match ? match[1] : jsonText;

    try {
        const parsed = JSON.parse(candidate);
        if (Array.isArray(parsed)) {
            return parsed.map(normalizeSingleQuestion);
        }
        if (parsed && Array.isArray(parsed.questions)) {
            return parsed.questions.map(normalizeSingleQuestion);
        }
    } catch (e) {
        console.warn('Advertencia parseando JSON de IA:', e);
    }

    return [];
};

const generateFallbackQuestions = (topics: string[], difficulty: number, targetCount: number = 10) => {
    const topicLabels = topics.length > 0
        ? topics.map(t => t.split('/')[1] || t).join(', ')
        : 'Nutrición y Dietética';

    const baseQuestions = [
        {
            id: 'fb-1',
            text: `[Nivel ${difficulty}] ¿Cuál es el rol fundamental de los macronutrientes en la intervención nutricional de: ${topicLabels}?`,
            options: [
                'Aportar energía y sustratos estructurales para la síntesis y mantenimiento celular.',
                'Catalizar reacciones enzimáticas sin aportar valor calórico ni estructural.',
                'Regular únicamente la presión osmótica plasmática en condiciones de deshidratación.',
                'Inactivar la absorción de micronutrientes hidrosolubles en el tubo digestivo.'
            ],
            correctAnswer: 0,
            rationale: 'Los macronutrientes (proteínas, carbohidratos y lípidos) aportan la energía estructural primaria para el metabolismo tisular.',
            hint: 'Considera la función metabólica y energética principal.'
        },
        {
            id: 'fb-2',
            text: `En el contexto clínico de las unidades seleccionadas (${topicLabels}), ¿cuál es un marcador bioquímico prioritario de evaluación proteica?`,
            options: [
                'La concentración plasmática de albúmina y la determinación del balance nitrogenado.',
                'El recuento aislado de plaquetas y hematocrito periférico.',
                'La excreción salival de nitrógeno ureico.',
                'La saturación de oxígeno arterial basal.'
            ],
            correctAnswer: 0,
            rationale: 'El balance nitrogenado y la albúmina/prealbúmina son marcadores estándar de la masa proteica visceral y somática.',
            hint: 'Relacionado con la evaluación del estado nutricional proteico.'
        },
        {
            id: 'fb-3',
            text: `¿Qué estrategia dietética y preventiva es clave al abordar los contenidos de: ${topicLabels}?`,
            options: [
                'Asegurar un aporte hídrico óptimo y un consumo adecuado de fibra dietética.',
                'Eliminar totalmente los carbohidratos de absorción compleja.',
                'Restringir los aminoácidos esenciales a menos del 5% del valor calórico total.',
                'Sustituir los ácidos grasos insaturados por grasas hidrogenadas trans.'
            ],
            correctAnswer: 0,
            rationale: 'La hidratación y la fibra dietética regulan la motilidad intestinal, la microbiota y la absorción de nutrientes.',
            hint: 'Salud digestiva y prevención de patologías metabólicas.'
        },
        {
            id: 'fb-4',
            text: `¿Cuál es la recomendación clínica ante un paciente con necesidad de soporte en: ${topicLabels}?`,
            options: [
                'Garantizar un plan hiperproteico e hipercalórico adaptado a su gasto metabólico basal.',
                'Ayuno prolongado intercalado con soluciones glucosadas de baja concentración.',
                'Suprimir la suplementación micronutricional sin análisis previo.',
                'Restringir el aporte hídrico basal a menos de 500 ml diarios.'
            ],
            correctAnswer: 0,
            rationale: 'El ajuste calórico-proteico individualizado restablece la masa corporal magra y previene la malnutrición.',
            hint: 'Estrategias de intervención y soporte clínico.'
        },
        {
            id: 'fb-5',
            text: `En la personalización dietética para las unidades ${topicLabels}, ¿qué factor es clave para maximizar la adherencia?`,
            options: [
                'Adaptar las pautas nutricionales a las preferencias culturales, horarios e historia clínica.',
                'Prescribir un menú idéntico e inflexible para todos los usuarios.',
                'Excluir por completo los carbohidratos complejos de bajo índice glucémico.',
                'Sustituir los alimentos frescos por fórmulas sintéticas de manera indistinta.'
            ],
            correctAnswer: 0,
            rationale: 'La adherencia depende directamente de integrar la prescripción con los hábitos y requerimientos del paciente.',
            hint: 'Factores de adherencia y variabilidad individual.'
        }
    ];

    const result = [];
    for (let i = 0; i < targetCount; i++) {
        const base = baseQuestions[i % baseQuestions.length];
        result.push({
            ...base,
            id: `fb-${i + 1}`,
            text: i >= baseQuestions.length ? `[Pregunta ${i + 1}] ${base.text}` : base.text
        });
    }
    return result;
};

const QuizEngine = ({ modules }: { modules: any[] }) => {
    const { 
        questions, 
        currentIndex, 
        answers,
        setQuestions, 
        isSubmitted, 
        submitQuiz, 
        difficulty,
        mode,
        numQuestions,
        resetQuiz,
        status,
        setStatus,
        selectedTopics
    } = useQuizStore();

    const [error, setError] = useState<string | null>(null);

    const fetchQuestions = async () => {
        setStatus('generating');
        setError(null);

        const aiPrompt = `Eres "Cerebro", tutor experto en Nutrición y Dietética de Alquimia LMS.
Genera un cuestionario de evaluación adaptativa con exactamente ${numQuestions} preguntas en idioma CASTELLANO.
Nivel de Dificultad: ${difficulty}/10.
Modo: ${mode}.
Unidades Didácticas Seleccionadas: ${selectedTopics.join(', ')}.

REGLA OBLIGATORIA: Responde ÚNICAMENTE con un arreglo JSON puro de ${numQuestions} objetos (sin texto conversacional antes o después), con este formato:
[
  {
    "id": "q1",
    "text": "Texto de la pregunta",
    "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
    "correctAnswer": 0,
    "rationale": "Explicación clínica detallada de la respuesta correcta",
    "hint": "Pista útil para el modo práctica"
  }
]`;

        try {
            const webhookUrl = '/api/cerebro';
            const payload = {
                chatInput: aiPrompt,
                action: "generate_quiz",
                sessionId: `quiz-${Date.now()}`,
                difficulty: difficulty,
                mode: mode,
                num_questions: numQuestions,
                selected_slugs: selectedTopics
            };

            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Servidor de Cerebro devolvió status HTTP ${response.status}`);
            }
            
            const data = await response.json();
            const parsedQuestions = extractAndNormalizeQuestions(data);
            
            if (parsedQuestions.length === 0) {
                console.warn('Respuesta de IA sin preguntas válidas, aplicando fallback local con la cantidad solicitada.');
                const fallback = generateFallbackQuestions(selectedTopics, difficulty, numQuestions);
                setQuestions(fallback);
            } else {
                if (parsedQuestions.length < numQuestions) {
                    const fallbackExtra = generateFallbackQuestions(selectedTopics, difficulty, numQuestions - parsedQuestions.length);
                    setQuestions([...parsedQuestions, ...fallbackExtra]);
                } else {
                    setQuestions(parsedQuestions.slice(0, numQuestions));
                }
            }
        } catch (err: any) {
            console.error('Error generando examen:', err);
            const fallback = generateFallbackQuestions(selectedTopics, difficulty, numQuestions);
            setQuestions(fallback);
        }
    };

    if (status === 'setup') {
        return <SubjectSelector modules={modules} onGenerate={fetchQuestions} />;
    }

    if (status === 'generating') {
        return (
            <div className="flex flex-col items-center justify-center h-full space-y-4 bg-slate-50 min-h-[400px]">
                <Loader2 className="w-12 h-12 text-medical-green-500 animate-spin" />
                <h2 className="text-xl font-bold text-slate-800">Forjando Evaluación Adaptativa</h2>
                <p className="text-slate-500 font-medium animate-pulse text-center max-w-md">
                    El Cerebro de Alquimia está procesando las unidades didácticas y compilando un test adaptado de {numQuestions} Preguntas (Nivel {difficulty})...
                </p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4 min-h-[400px]">
                <AlertCircle className="w-12 h-12 text-red-500" />
                <h3 className="text-lg font-bold text-slate-800">{error}</h3>
                <div className="flex gap-3">
                    <button 
                        onClick={() => { setError(null); setStatus('setup'); }} 
                        className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all"
                    >
                        Volver a Selección
                    </button>
                    <button 
                        onClick={fetchQuestions} 
                        className="px-5 py-2.5 rounded-xl bg-medical-green-600 hover:bg-medical-green-700 text-white text-xs font-bold transition-all shadow-md"
                    >
                        Reintentar Generación
                    </button>
                </div>
            </div>
        );
    }

    if (isSubmitted) {
        const total = questions.length;
        const correctCount = questions.filter(q => answers[q.id] === q.correctAnswer).length;
        const scorePercent = total > 0 ? Math.round((correctCount / total) * 100) : 0;

        let gradeLabel = 'Insuficiente';
        let gradeColor = 'text-red-600';
        let barColor = 'bg-red-500';

        if (scorePercent >= 90) {
            gradeLabel = 'Sobresaliente';
            gradeColor = 'text-medical-green-600';
            barColor = 'bg-medical-green-500';
        } else if (scorePercent >= 70) {
            gradeLabel = 'Notable';
            gradeColor = 'text-medical-green-600';
            barColor = 'bg-medical-green-500';
        } else if (scorePercent >= 50) {
            gradeLabel = 'Aprobado';
            gradeColor = 'text-amber-600';
            barColor = 'bg-amber-500';
        }

        const failedQuestions = questions.filter(q => answers[q.id] !== q.correctAnswer);

        return (
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center h-full p-6 md:p-8 space-y-6 overflow-y-auto custom-scrollbar bg-slate-50"
            >
                <div className="w-16 h-16 bg-medical-green-100 rounded-full flex items-center justify-center text-medical-green-600 shrink-0">
                    <CheckCircle2 className="w-8 h-8" />
                </div>

                <div className="text-center">
                    <h2 className="text-2xl md:text-3xl font-bold text-slate-800">Evaluación Completada</h2>
                    <p className="text-slate-500 mt-1 text-sm">
                        Has acertado <strong className="text-slate-800 font-bold">{correctCount}</strong> de <strong className="text-slate-800 font-bold">{total}</strong> preguntas ({scorePercent}%).
                    </p>
                </div>

                {/* Tarjeta de Puntuación Real */}
                <div className="bg-white rounded-2xl p-6 w-full max-w-xl border border-slate-200 shadow-sm space-y-3">
                   <div className="flex justify-between items-center">
                        <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Puntuación Final</span>
                        <span className={`text-sm font-black ${gradeColor}`}>
                            {scorePercent}% ({gradeLabel})
                        </span>
                   </div>
                   <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full ${barColor} transition-all duration-1000`} style={{ width: `${scorePercent}%` }}></div>
                   </div>
                   <div className="flex justify-between text-[11px] text-slate-500 font-semibold">
                        <span>Aciertos: {correctCount} / {total}</span>
                        <span>Errores: {failedQuestions.length}</span>
                   </div>
                </div>

                {/* Lista de Preguntas Falladas */}
                {failedQuestions.length > 0 ? (
                    <div className="w-full max-w-xl space-y-4 text-left">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                            <h3 className="text-xs font-black uppercase text-red-600 tracking-widest flex items-center gap-2">
                                <AlertCircle size={16} />
                                Preguntas Falladas ({failedQuestions.length})
                            </h3>
                        </div>

                        <div className="space-y-4">
                            {failedQuestions.map((q, idx) => {
                                const userAnsIdx = answers[q.id];
                                const userAnsText = userAnsIdx !== undefined && q.options[userAnsIdx] 
                                    ? q.options[userAnsIdx] 
                                    : 'Sin responder';
                                const correctAnsText = q.options[q.correctAnswer] || 'Respuesta no disponible';

                                return (
                                    <div key={q.id} className="bg-white rounded-2xl p-6 border border-red-100 shadow-sm space-y-3">
                                        <h4 className="text-sm font-bold text-slate-800 leading-snug">
                                            <span className="text-red-500 font-black mr-2">#{idx + 1}</span>
                                            {q.text}
                                        </h4>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                            <div className="p-3 bg-red-50/70 border border-red-100 rounded-xl text-red-900">
                                                <span className="block text-[10px] font-bold uppercase text-red-500 mb-1">Tu Respuesta:</span>
                                                <span className="text-xs font-medium">{userAnsText}</span>
                                            </div>

                                            <div className="p-3 bg-medical-green-50/70 border border-medical-green-100 rounded-xl text-medical-green-900">
                                                <span className="block text-[10px] font-bold uppercase text-medical-green-600 mb-1">Respuesta Correcta:</span>
                                                <span className="text-xs font-medium">{correctAnsText}</span>
                                            </div>
                                        </div>

                                        {q.rationale && (
                                            <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-600">
                                                <strong className="text-slate-800 font-bold block mb-1">Explicación Clínica:</strong>
                                                <p className="leading-relaxed">{q.rationale}</p>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="bg-medical-green-50 border border-medical-green-200 rounded-2xl p-6 w-full max-w-xl text-center">
                        <span className="text-sm font-bold text-medical-green-800">🎉 ¡Excelente! Has respondido correctamente a todas las preguntas del examen.</span>
                    </div>
                )}

                <div className="flex gap-4 pt-4 pb-8">
                    <button onClick={resetQuiz} className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all uppercase tracking-wider">Reiniciar Examen</button>
                    <a href="/dashboard" className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-md hover:bg-slate-800 transition-all">Volver al Dashboard</a>
                </div>
            </motion.div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-white overflow-hidden">
            {/* Header de la Evaluación Responsivo */}
            <header className="px-4 md:px-8 py-3 md:py-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white relative z-20 shrink-0">
                <div className="flex items-center gap-3 md:gap-6">
                    <button 
                        onClick={() => setStatus('setup')} 
                        className="text-slate-400 hover:text-slate-600 font-bold text-xs uppercase tracking-widest flex items-center gap-1 touch-target"
                    >
                        ← Volver
                    </button>
                    <div className="h-6 w-px bg-slate-100"></div>
                    <div className="flex flex-col">
                        <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Evaluación IA</span>
                        <span className="text-xs md:text-sm font-bold text-slate-800">{selectedTopics.length} Tópicos • {questions.length} Preguntas</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 md:gap-4 ml-auto sm:ml-0">
                    <span className={`text-[9px] md:text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                        mode === 'practice' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                    }`}>
                        {mode === 'practice' ? 'Práctica' : 'Simulacro'}
                    </span>
                    <AIStudyButton />
                    <button 
                        onClick={() => submitQuiz()}
                        className="bg-slate-900 text-white text-[9px] md:text-[10px] font-black uppercase tracking-[0.15em] md:tracking-[0.2em] px-4 md:px-8 py-2.5 md:py-3.5 rounded-xl hover:bg-slate-800 transition-all shadow-md flex items-center gap-2 touch-target"
                    >
                        <CheckCircle2 size={14} className="text-medical-green-400" />
                        <span className="hidden sm:inline">Finalizar Evaluación</span>
                        <span className="sm:hidden">Finalizar</span>
                    </button>
                </div>
            </header>

            {/* Barra de Progreso Dinámica */}
            <ProgressBar />

            {/* Contenedor de Preguntas SPA */}
            <main className="flex-1 overflow-y-auto bg-slate-50/30 p-3 md:p-8 flex justify-center custom-scrollbar">
                <div className="w-full max-w-2xl px-1 md:px-4">
                    <AnimatePresence mode="wait">
                        <QuestionCard key={currentIndex} />
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
};

export default QuizEngine;
