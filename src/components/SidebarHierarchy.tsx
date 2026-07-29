'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getLibraryStructure, Module } from '../lib/books';
import { supabase } from '../lib/supabase';

export default function SidebarHierarchy() {
  const pathname = usePathname();
  if (pathname?.startsWith('/admin')) return null;

  const [modules, setModules] = useState<Module[]>([]);
  const [totalDocs, setTotalDocs] = useState<number>(0);
  const [openModuleIds, setOpenModuleIds] = useState<Record<string, boolean>>({});

  const userId = 'estudiante-demo';

  useEffect(() => {
    async function loadData() {
      const data = await getLibraryStructure(userId);
      setModules(data);
      const total = data.reduce((acc, m) => acc + m.units.length, 0);
      setTotalDocs(total);

      const currentPath = pathname.toLowerCase();
      const activeMod = data.find(
        (m) =>
          currentPath.includes(`/${m.id.toLowerCase()}/`) ||
          currentPath.endsWith(`/${m.id.toLowerCase()}`)
      );
      if (activeMod) {
        setOpenModuleIds((prev) => ({ ...prev, [activeMod.id]: true }));
      }
    }
    loadData();
  }, [pathname]);

  useEffect(() => {
    const channel = supabase
      .channel('realtime_progress_next')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'nutricionista',
          table: 'pasos_completados',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const slug =
            payload.eventType === 'DELETE'
              ? (payload.old as any).document_slug
              : (payload.new as any).document_slug;
          const isRead = payload.eventType !== 'DELETE';

          setModules((prevModules) =>
            prevModules.map((mod) => ({
              ...mod,
              units: mod.units.map((unit) =>
                unit.slug === slug ? { ...unit, completado: isRead } : unit
              ),
            }))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const toggleModule = (id: string) => {
    setOpenModuleIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const currentPath = pathname.toLowerCase();
  const activeModule = modules.find(
    (m) =>
      currentPath.includes(`/${m.id.toLowerCase()}/`) ||
      currentPath.endsWith(`/${m.id.toLowerCase()}`)
  );
  const activeModuleUnits = activeModule?.units || [];
  const completedInModule = activeModuleUnits.filter((u) => u.completado).length;
  const progressPercentage =
    activeModuleUnits.length > 0
      ? Math.round((completedInModule / activeModuleUnits.length) * 100)
      : 0;

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div>
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Currículo FP</h2>
        </div>
        <div className="bg-medical-green-100 text-medical-green-700 text-[9px] font-black px-2 py-0.5 rounded-full border border-medical-green-200 shadow-sm animate-pulse">
          {totalDocs} DOCS
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {pathname.startsWith('/admin') && (
          <Link
            href="/admin/calendario"
            className="w-full flex items-center justify-between p-4 mb-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] bg-slate-900 border border-slate-700 text-white shadow-xl shadow-slate-900/10 hover:bg-slate-800 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-medical-green-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-medical-green-500/20">
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
                    strokeWidth={2.5}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <span>
                Calendario <span className="text-medical-green-400 italic">Admin</span>
              </span>
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3 w-3 transform group-hover:translate-x-1 transition-transform text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </Link>
        )}

        <div className="px-1 mb-4">
          <h3 className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">Asignaturas</h3>
        </div>

        {modules.map((mod) => {
          const isOpen = !!openModuleIds[mod.id];
          const isActiveMod = activeModule?.id === mod.id;

          return (
            <div key={mod.id} className="module-group">
              <button
                onClick={() => toggleModule(mod.id)}
                className={`w-full flex items-center justify-between p-2.5 rounded-lg text-sm font-semibold transition-all ${
                  isActiveMod
                    ? 'bg-medical-green-50 text-medical-green-800'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-4 w-4 ${isActiveMod ? 'text-medical-green-500' : 'text-slate-400'}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                    />
                  </svg>
                  <span className="truncate">{mod.name}</span>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-3 w-3 transform transition-transform ${
                    isOpen ? 'rotate-90' : ''
                  } text-slate-400`}
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
              </button>

              {isOpen && (
                <div className="ml-9 mt-1 space-y-1 border-l border-medical-green-200 pl-3 py-1">
                  {mod.units.map((unit) => {
                    const isUnitActive = pathname.includes(`/${unit.slug}`);

                    return (
                      <Link
                        key={unit.slug}
                        href={`/leccion/${mod.id}/${unit.slug}`}
                        className={`flex items-center justify-between py-1.5 text-xs transition-all border-l-2 pl-2 group ${
                          isUnitActive
                            ? 'text-medical-green-700 font-bold border-medical-green-500'
                            : 'text-slate-500 hover:text-medical-green-700 border-transparent hover:border-medical-green-300'
                        }`}
                      >
                        <span className="truncate">
                          {unit.nombre.replace(/\.(pdf|PDF|docx|DOCX)$/, '')}
                        </span>

                        <div
                          className={`shrink-0 transition-all ${
                            unit.completado ? 'opacity-100' : 'opacity-0 scale-50'
                          }`}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3 w-3 text-medical-green-500"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Progress Footer */}
      <div className="p-6 border-t border-slate-100 bg-slate-50/50 shadow-[0_-4px_12px_rgba(0,0,0,0.02)]">
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-tighter">Progreso del Módulo</span>
          <span className="text-sm font-black text-medical-green-600 tabular-nums">
            {progressPercentage}%
          </span>
        </div>
        <div className="w-full h-2.5 bg-slate-200/50 rounded-full overflow-hidden border border-slate-100">
          <div
            className="h-full bg-medical-green-500 shadow-[0_0_8px_rgba(16,185,129,0.3)] transition-all duration-700 ease-out"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}
