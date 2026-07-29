'use client';

import React from 'react';
import FullCalendar from '@/components/FullCalendar';
import AdminProtectedRoute from '@/components/admin/AdminProtectedRoute';

export default function AdminCalendarioPage() {
  return (
    <AdminProtectedRoute>
      <div className="p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">
              Panel de Control: <span className="text-medical-green-500">Calendario</span>
            </h1>
            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">
              Gestión de fechas críticas y eventos para alumnos
            </p>
          </div>
          <div className="flex gap-4">
            <button className="px-6 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
              Exportar ICS
            </button>
            <button className="px-6 py-3 bg-medical-green-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-medical-green-700 transition-all shadow-xl shadow-medical-green-600/20">
              Añadir Evento +
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden">
          <FullCalendar />
        </div>
      </div>
    </AdminProtectedRoute>
  );
}
