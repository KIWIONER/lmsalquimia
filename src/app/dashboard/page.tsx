import React from 'react';
import Link from 'next/link';
import { BookOpen, GraduationCap, Clock, Award } from 'lucide-react';
import { getLibraryStructure } from '@/lib/books';
import AIStudyButton from '@/components/AIStudyButton';

export default async function DashboardPage() {
  const userId = 'estudiante-demo';
  const structure = await getLibraryStructure(userId);

  const allUnits = structure.flatMap((m) => m.units);
  const totalUnits = allUnits.length;
  const completedUnits = allUnits.filter((u) => u.completado).length;
  const studyTimeHours = ((completedUnits * 25) / 60).toFixed(1);

  let nextUnit = null;
  let currentModule = null;

  for (const mod of structure) {
    const pending = mod.units.find((u) => !u.completado);
    if (pending) {
      nextUnit = pending;
      currentModule = mod;
      break;
    }
  }

  if (!nextUnit && structure.length > 0) {
    nextUnit = structure[0].units[0];
    currentModule = structure[0];
  }

  const continueLink = nextUnit && currentModule
    ? `/leccion/${currentModule.id}/${nextUnit.slug}`
    : '/biblioteca';

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6 md:space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-800 tracking-tight">Centro de Mando Académico</h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-medical-green-500 shrink-0"></span>
            Curso Actual: Técnico Superior en Dietética (FP)
          </p>
        </div>
        <div className="self-start sm:self-auto">
          <AIStudyButton />
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <BookOpen size={20} className="sm:hidden" />
            <BookOpen size={24} className="hidden sm:block" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Unidades</p>
            <p className="text-lg sm:text-xl font-bold text-slate-800">
              {completedUnits} / {totalUnits}
            </p>
          </div>
        </div>
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-medical-green-50 text-medical-green-600 flex items-center justify-center shrink-0">
            <GraduationCap size={20} className="sm:hidden" />
            <GraduationCap size={24} className="hidden sm:block" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Aprobados</p>
            <p className="text-lg sm:text-xl font-bold text-slate-800">{completedUnits} Temas</p>
          </div>
        </div>
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock size={20} className="sm:hidden" />
            <Clock size={24} className="hidden sm:block" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Estudio</p>
            <p className="text-lg sm:text-xl font-bold text-slate-800">{studyTimeHours}h</p>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        <section className="space-y-3 sm:space-y-4">
          <h3 className="text-base sm:text-lg font-bold text-slate-800">Continuar Estudiando</h3>
          <Link href={continueLink} className="block">
            <div className="group relative bg-white border border-slate-100 p-5 sm:p-6 rounded-3xl shadow-sm hover:shadow-xl hover:shadow-medical-green-500/5 transition-all duration-500 cursor-pointer overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-medical-green-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
              <div className="relative z-10">
                <span className="text-[10px] font-bold text-medical-green-600 uppercase tracking-widest bg-medical-green-50 px-2 py-1 rounded-md">
                  {currentModule?.name || 'Módulo'}
                </span>
                <h4 className="text-lg sm:text-xl font-bold text-slate-800 mt-3">
                  {nextUnit?.nombre || 'Selecciona un tema'}
                </h4>
                <p className="text-xs sm:text-sm text-slate-500 mt-2">
                  {nextUnit?.completado
                    ? '¡Unidad completada! Puedes repasarla.'
                    : 'Tu siguiente paso para dominar este módulo.'}
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs font-bold text-medical-green-600 group-hover:translate-x-1 transition-transform">
                  <span>Ir a la Lección</span>
                  <span>→</span>
                </div>
              </div>
            </div>
          </Link>
        </section>

        <section className="space-y-3 sm:space-y-4">
          <h3 className="text-base sm:text-lg font-bold text-slate-800">Tu Progreso</h3>
          <div className="bg-white border border-slate-100 p-5 sm:p-6 rounded-3xl shadow-sm space-y-4">
            <div className="flex justify-between items-center text-xs font-bold text-slate-600">
              <span>Progreso Global del Curso</span>
              <span>{Math.round((completedUnits / (totalUnits || 1)) * 100)}%</span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-medical-green-500 transition-all duration-1000"
                style={{ width: `${Math.round((completedUnits / (totalUnits || 1)) * 100)}%` }}
              ></div>
            </div>
            <p className="text-xs text-slate-400">
              Has completado {completedUnits} de {totalUnits} unidades del currículo.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
