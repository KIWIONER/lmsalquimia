import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileCheck2,
  GraduationCap,
  HeartPulse,
  Layers,
  Lock,
  Microscope,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#f6fbf9] text-slate-900 flex flex-col">
      {/* Sticky Public Header */}
      <header className="sticky top-0 z-50 h-16 bg-white/90 backdrop-blur-md border-b border-emerald-100/80 px-6">
        <div className="max-w-6xl mx-auto h-full flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-black text-lg tracking-tight text-slate-900">
                Alquimia <span className="text-emerald-600">LMS</span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
                Ciencias de la Salud
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-600">
            <a href="#como-funciona" className="hover:text-emerald-700 transition-colors">
              Cómo funciona
            </a>
            <a href="#acceso-demo" className="hover:text-emerald-700 transition-colors">
              Acceso Demo
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <Link
              href="/login"
              className="px-4 py-2 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all"
            >
              Alumno Demo
            </Link>
            <Link
              href="/admin"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition-all"
            >
              Profesor Demo
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section
        className="relative overflow-hidden border-b border-emerald-100"
        style={{
          paddingTop: '5rem',
          paddingBottom: '5.5rem',
          background:
            'radial-gradient(circle at 85% 20%, rgba(16, 185, 129, 0.14), transparent 45%), radial-gradient(circle at 10% 85%, rgba(20, 184, 166, 0.10), transparent 40%), linear-gradient(180deg, #ffffff 0%, #f3faf6 100%)',
        }}
      >
        <div className="max-w-6xl mx-auto px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 items-center" style={{ gap: '4rem' }}>
            {/* Hero Left */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold tracking-wide">
                <Microscope className="w-3.5 h-3.5 text-emerald-600" />
                Nutrición, Dietética y Seguridad Alimentaria
              </div>

              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 leading-[1.08]">
                Conocimiento clínico exacto, convertido en{' '}
                <span className="text-emerald-600">aprendizaje vivo.</span>
              </h1>

              <p className="text-base md:text-lg text-slate-600 leading-relaxed">
                <strong>Alquimia LMS</strong> transforma temarios técnicos en PDF en micro-lecciones estructuradas,
                evaluaciones adaptativas y un tutor científico con{' '}
                <strong className="text-slate-900">tolerancia cero a errores numéricos</strong> y revisión docente antes
                de publicar.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 transition-all"
                >
                  <GraduationCap className="w-4 h-4" />
                  Entrar como Alumno Demo
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-lg shadow-slate-900/15 transition-all"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  Probar Panel Profesor
                </Link>
              </div>

              {/* Clinical Trust Metrics */}
              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-emerald-100">
                <div>
                  <div className="text-xl font-black text-emerald-700">100%</div>
                  <div className="text-xs font-medium text-slate-500 mt-0.5">
                    Integridad de cifras (°C, pH, mg)
                  </div>
                </div>
                <div>
                  <div className="text-xl font-black text-slate-900">4 Capas</div>
                  <div className="text-xs font-medium text-slate-500 mt-0.5">
                    Ingesta determinista + IA
                  </div>
                </div>
                <div>
                  <div className="text-xl font-black text-teal-700">AWS + RAG</div>
                  <div className="text-xs font-medium text-slate-500 mt-0.5">
                    S3, SQS, Lambda y Qdrant
                  </div>
                </div>
              </div>
            </div>

            {/* Hero Right: Visual Clinical Card Transformation Showcase */}
            <div className="relative">
              <div className="bg-white rounded-3xl border border-emerald-200/80 shadow-2xl shadow-emerald-900/10 overflow-hidden">
                {/* Mock Window Header */}
                <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      Control Alimentario · Tarjeta Verificada
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                    Guardrail OK
                  </span>
                </div>

                {/* Card Body */}
                <div className="p-6 space-y-5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-xl bg-slate-900 text-white text-xs font-black flex items-center justify-center">
                        13
                      </span>
                      <h3 className="font-bold text-slate-900 text-base">
                        Pasteurización e Higienización
                      </h3>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase">
                      <CheckCircle2 className="w-3 h-3" />
                      Verificada
                    </span>
                  </div>

                  <p className="text-sm text-slate-600 leading-relaxed">
                    Tratamiento térmico a baja temperatura diseñado para destruir microorganismos patógenos e inactivar
                    enzimas conservando la calidad nutricional del alimento:
                  </p>

                  {/* Highlighted Clinical Figures */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100">
                      <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                        HTST (Leche)
                      </div>
                      <div className="text-lg font-black text-slate-900 mt-1">72 °C · 15 s</div>
                      <div className="text-[11px] text-slate-500">Alta temp., corto tiempo</div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-100">
                      <div className="text-[10px] font-black uppercase tracking-wider text-teal-700">
                        Reducción Microbiana
                      </div>
                      <div className="text-lg font-black text-slate-900 mt-1">95–99%</div>
                      <div className="text-[11px] text-slate-500">Cifra validada vs. PDF S3</div>
                    </div>
                  </div>

                  {/* Footer Status Bar */}
                  <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-slate-500 font-medium">
                      <FileCheck2 className="w-4 h-4 text-emerald-600" />
                      Sincronizado con PDF original (Pág. 10)
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-[11px]">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      Mini-Test Listo
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works — 3 Pillars */}
      <section
        id="como-funciona"
        className="max-w-6xl mx-auto px-8 space-y-12"
        style={{ paddingTop: '5.5rem', paddingBottom: '5.5rem' }}
      >
        <div className="max-w-2xl space-y-2">
          <span className="text-xs font-black uppercase tracking-widest text-emerald-600">
            Diseñado para rigor sanitario
          </span>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            De apuntes técnicos en PDF a formación interactiva verificada
          </h2>
          <p className="text-sm md:text-base text-slate-600">
            Cada etapa del pipeline está pensada para proteger la exactitud científica y facilitar tanto la docencia
            como el estudio diario.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '2rem' }}>
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Guardrail Numérico Bidireccional</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Detecta automáticamente omisiones o alteraciones en dosis, temperaturas (<code className="font-mono text-emerald-700">°C</code>), porcentajes y valores de <code className="font-mono text-emerald-700">pH</code> comparando el PDF original con cada tarjeta.
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Flujo Docente Human-in-the-Loop</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Los nuevos temarios nacen en borrador oculto al alumno. El profesor revisa tarjeta a tarjeta junto al visor PDF en S3, edita en Editor o Markdown y publica al verificar el 100%.
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <div className="w-11 h-11 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Micro-Learning y Tutor RAG</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Al publicar, el contenido queda disponible para estudio por tarjetas, mini-tests adaptativos e indexación vectorial híbrida en Qdrant para resolver dudas con contexto real.
            </p>
          </div>
        </div>
      </section>

      {/* Dual Demo Portals */}
      <section
        id="acceso-demo"
        className="bg-white border-t border-emerald-100"
        style={{ paddingTop: '5.5rem', paddingBottom: '6rem' }}
      >
        <div className="max-w-6xl mx-auto px-8 space-y-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-emerald-600">
                Acceso Controlado
              </span>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mt-1">
                Prueba Alquimia LMS en Modo Demo
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                El registro libre está cerrado. Elige el perfil que deseas explorar con las credenciales de prueba.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 self-start">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              Entorno Demo Seguro
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '2.5rem' }}>
            {/* Student Demo Portal */}
            <div className="rounded-3xl border-2 border-emerald-100 bg-gradient-to-b from-emerald-50/40 to-white p-8 shadow-sm flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-black uppercase tracking-wider">
                    <BookOpen className="w-3.5 h-3.5" />
                    Rol Alumno
                  </span>
                  <span className="text-xs font-semibold text-slate-400">Lectura y Evaluaciones</span>
                </div>

                <h3 className="text-2xl font-black text-slate-900">Portal de Estudio</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Explora las asignaturas publicadas, estudia con tarjetas limpias sincronizadas con el PDF original y
                  pon a prueba tus conocimientos con evaluaciones y mini-tests.
                </p>

                <ul className="space-y-2 text-xs text-slate-600 font-medium">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    Acceso a biblioteca y lecciones publicadas
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    Mini-tests por tarjeta y simulacros de examen
                  </li>
                </ul>

                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs space-y-1.5">
                  <div>
                    <span className="text-slate-400 font-semibold">Email Demo:</span>{' '}
                    <code className="font-mono font-bold text-slate-900">demo.alumno@alquimia.es</code>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold">Contraseña:</span>{' '}
                    <code className="font-mono font-bold text-slate-900">DemoAlumno2026!</code>
                  </div>
                </div>
              </div>

              <Link
                href="/login"
                className="w-full py-3.5 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm text-center shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
              >
                Acceder como Alumno Demo
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Teacher Demo Portal */}
            <div className="rounded-3xl border-2 border-slate-200 bg-gradient-to-b from-slate-50/70 to-white p-8 shadow-sm flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-100 text-amber-900 text-xs font-black uppercase tracking-wider">
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    Rol Profesor Demo
                  </span>
                  <span className="text-xs font-semibold text-slate-400">Chunking &amp; Revisión</span>
                </div>

                <h3 className="text-2xl font-black text-slate-900">Panel Docente y Motor IA</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Prueba en directo cómo el pipeline de 4 capas estructura un PDF de muestra en S3, edita tarjetas en
                  TipTap o Markdown y revisa la verificación antes de publicar.
                </p>

                <ul className="space-y-2 text-xs text-slate-600 font-medium">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                    Ejecuta chunking en vivo sobre PDF de muestra (AWS S3)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                    Temario real protegido (sin subidas externas ni borrado)
                  </li>
                </ul>

                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs space-y-1.5">
                  <div>
                    <span className="text-slate-400 font-semibold">Email Demo:</span>{' '}
                    <code className="font-mono font-bold text-slate-900">profesor.demo@alquimia.es</code>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold">Contraseña:</span>{' '}
                    <code className="font-mono font-bold text-slate-900">DemoProfesor2026!</code>
                  </div>
                </div>
              </div>

              <Link
                href="/admin"
                className="w-full py-3.5 px-5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm text-center shadow-md shadow-slate-900/15 transition-all flex items-center justify-center gap-2"
              >
                Acceder como Profesor Demo
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 px-8 mt-auto" style={{ paddingTop: '2.5rem', paddingBottom: '2.5rem' }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-bold text-white">
            <HeartPulse className="w-4 h-4 text-emerald-400" />
            Alquimia LMS · Ciencias de la Salud
          </div>
          <div>Plataforma educativa en Modo Demo · AWS S3 · PostgreSQL · Qdrant</div>
        </div>
      </footer>
    </div>
  );
}
