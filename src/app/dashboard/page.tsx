import React from 'react';
import Link from 'next/link';
import { BookOpen, GraduationCap, Clock, Award } from 'lucide-react';
import { getLibraryStructure } from '@/lib/books';
import AIStudyButton from '@/components/AIStudyButton';
import { createClient } from '@/lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id || 'estudiante-demo';
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
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-10 flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight">Centro de Mando Académico</h1>
          <p className="text-slate-500 text-sm mt-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-medical-green-500"></span>
            Curso Actual: Técnico Superior en Dietética (FP)
          </p>
        </div>
        <AIStudyButton />
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <BookOpen size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Unidades</p>
            <p className="text-xl font-bold text-slate-800">
              {completedUnits} / {totalUnits}
            </p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-medical-green-50 text-medical-green-600 flex items-center justify-center">
            <GraduationCap size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Aprobados</p>
            <p className="text-xl font-bold text-slate-800">{completedUnits} Temas</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Estudio</p>
            <p className="text-xl font-bold text-slate-800">{studyTimeHours}h</p>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="space-y-4">
          <h3 className="text-lg font-bold text-slate-800">Continuar Estudiando</h3>
          <div className="group relative bg-white border border-slate-100 p-6 rounded-3xl shadow-sm hover:shadow-xl hover:shadow-medical-green-500/5 transition-all duration-500 cursor-pointer overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-medical-green-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
            <div className="relative z-10">
              <span className="text-[10px] font-bold text-medical-green-600 uppercase tracking-widest bg-medical-green-50 px-2 py-1 rounded-md">
                {currentModule?.name || 'Módulo'}
              </span>
              <h4 className="text-xl font-bold text-slate-800 mt-3">
                {nextUnit?.nombre || 'Selecciona un tema'}
              </h4>
              <p className="text-sm text-slate-500 mt-2">
                {nextUnit?.completado
                  ? '¡Unidad completada! Puedes repasarla.'
                  : 'Tu siguiente paso para dominar este módulo.'}
              </p>
              <div className="mt-6 flex items-center justify-between">
                <div className="flex -space-x-2">
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-200"></div>
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-300 flex items-center justify-center text-[10px] font-bold">
                    +{totalUnits - completedUnits}
                  </div>
                </div>
                <Link
                  href={continueLink}
                  className="btn-medical text-xs shadow-md shadow-medical-green-500/20"
                >
                  Abrir Aula Virtual
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-lg font-bold text-slate-800">Evaluación Destacada</h3>
          <div className="bg-white border border-slate-100 p-6 rounded-3xl shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Award size={20} />
              </div>
              <h4 className="font-bold text-slate-800">Examen Parcial Módulo 1</h4>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed italic">
              Prepárate para la evaluación adaptativa. Gemini generará preguntas basadas en tus
              lecturas de Alimentación Equilibrada.
            </p>
            <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-600">DISPONIBLE</span>
              <Link
                href="/evaluacion"
                className="text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest"
              >
                Configurar Examen
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
