import React from 'react';
import QuizEngine from '@/components/quiz/QuizEngine';
import { getLibraryStructure } from '@/lib/books';

export default async function EvaluacionPage() {
  const modules = await getLibraryStructure();

  return (
    <div className="h-full bg-white flex flex-col">
      <QuizEngine modules={modules} />
    </div>
  );
}
