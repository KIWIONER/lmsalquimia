import React from 'react';
import LibraryExplorer from '@/components/LibraryExplorer';
import AIStudyButton from '@/components/AIStudyButton';
import { getLibraryStructure } from '@/lib/books';

export default async function BibliotecaPage() {
  const modules = await getLibraryStructure();

  return (
    <div className="p-6">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Biblioteca Académica</h1>
          <p className="text-slate-500 text-sm mt-1">
            Explora tu material de estudio y consulta con el Agente Alquimia.
          </p>
        </div>
        <AIStudyButton />
      </header>

      <LibraryExplorer modules={modules} />
    </div>
  );
}
