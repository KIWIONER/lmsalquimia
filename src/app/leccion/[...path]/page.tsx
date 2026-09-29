import Link from 'next/link';
import { redirect } from 'next/navigation';
import LessonContentViewer from '@/components/lesson/LessonContentViewer';
import AIStudyButton from '@/components/AIStudyButton';
import { getLibraryStructure } from '@/lib/books';
import { supabase } from '@/lib/supabase';

export interface LessonPageProps {
  params: Promise<{
    path?: string[];
  }>;
}

export async function generateStaticParams() {
  const structure = await getLibraryStructure();
  const paths: { path: string[] }[] = [];

  structure.forEach((mod) => {
    mod.units.forEach((unit) => {
      paths.push({
        path: [mod.id, unit.slug],
      });
    });
  });

  return paths;
}

export default async function LessonPage({ params }: LessonPageProps) {
  const resolvedParams = await params;
  const path = resolvedParams.path || [];

  if (path.length === 0) {
    redirect('/biblioteca');
  }

  const moduleSlug = path[0];
  const unitSlug = path.slice(1).join('/');

  const structure = await getLibraryStructure();
  const activeModule = structure.find((m) => m.id === moduleSlug);

  if (!activeModule) {
    redirect('/biblioteca');
  }

  if (!unitSlug) {
    if (activeModule.units.length > 0) {
      redirect(`/leccion/${activeModule.id}/${activeModule.units[0].slug}`);
    } else {
      redirect('/biblioteca');
    }
  }

  // Redirigir la portada "inicio" al primer tema real de la asignatura
  if (unitSlug === 'inicio' && activeModule.units.length > 0) {
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

  let docId: string | null = finalUnit?.id || null;

  // Fallback si no venía id
  if (!docId && finalUnit) {
    const { data } = await supabase
      .schema('nutricionista')
      .from('documentos')
      .select('id')
      .ilike('nombre', `%${unitNombre}%`)
      .limit(1)
      .single();
    if (data) docId = data.id;
  }

  const moduleDisplayName = activeModule?.name || moduleSlug;

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 overflow-hidden font-sans select-text">
      {/* Top Header Navigation */}
      <nav className="h-14 bg-white border-b border-slate-200/80 px-4 md:px-6 flex items-center justify-between shrink-0 z-30 shadow-2xs">
        {/* Left Side: Breadcrumb & Title */}
        <div className="flex items-center space-x-2 md:space-x-3 overflow-hidden pr-2">
          <Link
            href="/biblioteca"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-medical-green-600 transition-colors bg-slate-50 hover:bg-medical-green-50/50 px-2.5 py-1.5 rounded-lg border border-slate-200/60"
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
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            <span className="hidden sm:inline">Biblioteca</span>
          </Link>

          <span className="text-slate-300">/</span>

          <span className="text-xs font-bold text-slate-700 bg-slate-100/80 px-2.5 py-1 rounded-md max-w-[120px] md:max-w-[200px] truncate">
            {moduleDisplayName}
          </span>

          <span className="text-slate-300">/</span>

          <span className="text-xs font-extrabold text-slate-900 truncate max-w-[150px] md:max-w-[320px]">
            {unitNombre.replace(/\.(pdf|PDF|docx|DOCX)$/, '')}
          </span>
        </div>

        {/* Right Side: Quick Action Pills */}
        <div className="flex items-center space-x-2 shrink-0">
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-medical-green-700 bg-white hover:bg-medical-green-50/40 border border-slate-200 hover:border-medical-green-200 rounded-lg shadow-2xs transition-all"
              title="Abrir PDF original en pestaña nueva"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3.5 w-3.5 text-slate-400"
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
              <span>PDF Original</span>
            </a>
          )}
          <div className="scale-75 md:scale-90 origin-right shrink-0">
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
            pdfUrl={pdfUrl}
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
                  strokeWidth={1.5}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-700">No se encontró contenido para esta lección</h3>
            <p className="text-sm text-slate-400 max-w-sm">
              Selecciona otra unidad en el menú lateral o consulta la biblioteca general.
            </p>
            <div className="flex gap-3 pt-2">
              <Link
                href="/biblioteca"
                className="px-4 py-2 bg-medical-green-500 hover:bg-medical-green-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                Ir a Biblioteca
              </Link>
              {pdfUrl && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  Ver PDF Directo
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
