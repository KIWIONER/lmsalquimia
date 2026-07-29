import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import LessonContentViewer from '@/components/LessonContentViewer';
import AIStudyButton from '@/components/AIStudyButton';
import { getLibraryStructure } from '@/lib/books';
import { supabase } from '@/lib/supabase';
import { createClient } from '@/lib/supabase/server';

export interface LessonPageProps {
  params: Promise<{
    path?: string[];
  }>;
}

export async function generateStaticParams() {
  return [
    { path: ['m1', 'inicio'] },
    { path: ['m1', 'ud1'] },
    { path: ['m2', 'inicio'] },
    { path: ['m2', 'ud1'] },
  ];
}

export default async function LessonPage({ params }: LessonPageProps) {
  const resolvedParams = await params;
  const pathParts = resolvedParams.path || [];
  const moduleCode = pathParts[0]?.toLowerCase() || '';
  const unitSlug = pathParts[1]?.toLowerCase() || '';

  const serverSupabase = await createClient();
  const {
    data: { user },
  } = await serverSupabase.auth.getUser();
  const userId = user?.id || 'estudiante-demo';

  const structure = await getLibraryStructure(userId);
  const activeModule = structure.find((m) => m.id.toLowerCase() === moduleCode);

  if (unitSlug === 'inicio' && activeModule && activeModule.units.length > 0) {
    redirect(`/leccion/${activeModule.id}/${activeModule.units[0].slug}`);
  }

  const activeUnit = activeModule?.units.find((u) => u.slug === unitSlug);
  const fallbackUnit = !activeUnit
    ? activeModule?.units.find(
        (u) =>
          u.nombre.toLowerCase().replace(/\.(pdf|PDF|docx|DOCX)$/, '').trim() === unitSlug
      )
    : null;

  const finalUnit = activeUnit || fallbackUnit;
  const pdfUrl = finalUnit?.url;
  const unitNombre = finalUnit?.nombre || unitSlug;

  let docId: string | null = null;
  if (finalUnit) {
    const { data } = await supabase
      .schema('nutricionista')
      .from('documentos')
      .select('id')
      .eq('nombre', finalUnit.nombre)
      .eq('carpeta', finalUnit.carpeta)
      .single();

    if (data) {
      docId = data.id;
    }
  }

  const moduleDisplayName =
    activeModule?.name ||
    moduleCode.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Top Bar Navigation */}
      <nav className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-white/80 backdrop-blur-sm z-10 shrink-0">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link href="/biblioteca" className="hover:text-medical-green-600 transition-colors">
            Biblioteca
          </Link>
          <span>/</span>
          <span className="font-medium text-slate-700">{moduleDisplayName}</span>
          <span>/</span>
          <span className="text-medical-green-600 font-bold bg-medical-green-50 px-2 py-0.5 rounded-full">
            {unitNombre.replace(/\.(pdf|PDF|docx|DOCX)$/, '')}
          </span>
        </div>

        <div className="flex items-center gap-6">
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] font-bold text-slate-400 hover:text-medical-green-600 transition-colors flex items-center gap-1.5 shrink-0"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
              NUEVA PESTAÑA
            </a>
          )}
          <div className="scale-90 origin-right">
            <AIStudyButton />
          </div>
        </div>
      </nav>

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-slate-100/30">
        {docId ? (
          <LessonContentViewer
            docId={docId}
            unitName={unitNombre.replace(/\.(pdf|PDF|docx|DOCX)$/, '')}
            moduleName={moduleDisplayName}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 space-y-5 text-center bg-white">
            <div className="w-16 h-16 bg-medical-green-50 rounded-2xl flex items-center justify-center mb-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-medical-green-400"
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
            </div>
            <h3 className="text-xl font-bold text-slate-600 border-none pb-0 mt-0">Contenido en Proceso</h3>
            <p className="text-sm max-w-xs leading-relaxed">
              El texto procesado para esta unidad aún no está disponible.
            </p>
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-medical text-[10px] py-2 px-6 bg-slate-800 shadow-lg mt-4"
              >
                Abrir PDF Original
              </a>
            )}
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <footer className="h-16 border-t border-slate-200 bg-white px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6">
          <Link
            href="/biblioteca"
            className="flex items-center gap-2 group text-slate-400 hover:text-slate-800 transition-all"
          >
            <div className="w-8 h-8 rounded-lg border border-slate-100 flex items-center justify-center group-hover:bg-slate-50">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Biblioteca</span>
          </Link>
        </div>
      </footer>
    </div>
  );
}
