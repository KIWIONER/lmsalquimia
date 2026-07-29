import React from 'react';
import Link from 'next/link';
import { Module } from '../lib/books';

const colors = [
  'bg-medical-green-500',
  'bg-indigo-500',
  'bg-amber-500',
  'bg-red-500',
  'bg-slate-700',
  'bg-emerald-600',
  'bg-blue-600',
];

interface LibraryExplorerProps {
  modules: Module[];
}

export default function LibraryExplorer({ modules }: LibraryExplorerProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
      {modules.map((mod, i) => {
        const totalUnits = mod.units.length;
        const completedUnits = mod.units.filter((u) => u.completado).length;
        const progressPercentage =
          totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;

        return (
          <div
            key={mod.id}
            className="group bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-medical-green-500/10 transition-all duration-500 overflow-hidden flex flex-col min-h-[400px]"
          >
            {/* Portada Representativa */}
            <div
              className={`h-48 ${colors[i % colors.length]} relative flex items-center justify-center overflow-hidden`}
            >
              <div className="absolute inset-0 bg-black/10"></div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-16 w-16 text-white/20"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              <div className="absolute bottom-3 left-4 flex flex-col">
                <span className="text-[9px] font-bold text-white/80 uppercase tracking-widest bg-white/10 backdrop-blur-md px-2 py-0.5 rounded w-fit">
                  Módulo {i + 1}
                </span>
                <span className="text-[10px] font-bold text-white mt-1">{totalUnits} Documentos</span>
              </div>
            </div>

            <div className="p-6 flex-1 flex flex-col">
              <h3 className="font-bold text-slate-800 text-lg leading-tight group-hover:text-medical-green-600 transition-colors">
                {mod.name}
              </h3>
              <p className="text-xs text-slate-400 mt-2 line-clamp-2 italic">
                Contenido oficial del Grado Superior en Dietética sincronizado directamente desde la
                base de datos nutricionista.
              </p>

              {/* Progress Bar */}
              <div className="mt-5">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  <span>Progreso</span>
                  <span
                    className={`transition-colors ${
                      progressPercentage === 100 ? 'text-medical-green-600' : 'text-slate-600'
                    }`}
                  >
                    {progressPercentage}%
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      progressPercentage === 100
                        ? 'bg-medical-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]'
                        : 'bg-slate-800'
                    }`}
                    style={{ width: `${progressPercentage}%` }}
                  ></div>
                </div>
              </div>

              <div className="mt-auto pt-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-medical-green-500"></div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Indexado
                  </span>
                </div>
                {mod.firstUnit && (
                  <Link
                    href={`/leccion/${mod.id}/${mod.firstUnit.slug}`}
                    className="text-xs font-bold text-medical-green-600 hover:text-medical-green-700 flex items-center gap-1 group/btn"
                  >
                    Estudiar
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 transform group-hover/btn:translate-x-1 transition-transform"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
