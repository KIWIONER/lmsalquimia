'use client';

import React from 'react';
import { useQuizStore } from '../../store/quizStore';

const ProgressBar = () => {
    const { questions, answers } = useQuizStore();
    
    if (questions.length === 0) return null;

    const total = questions.length;
    const answered = Object.keys(answers).length;
    const progress = Math.min(100, Math.max(0, (answered / total) * 100));

    let barColor = 'bg-medical-green-500';
    if (progress < 30) barColor = 'bg-slate-300';
    else if (progress < 70) barColor = 'bg-medical-green-300';

    return (
        <div className="w-full bg-slate-100 relative shrink-0">
            <div 
                className={`h-1.5 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(16,185,129,0.3)] ${barColor}`}
                style={{ width: `${progress}%` }}
            ></div>
        </div>
    );
};

export default ProgressBar;
