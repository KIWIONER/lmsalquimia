import React from 'react';

export default function HistorialPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Historial de Consultas</h1>
        <p className="text-slate-500 text-sm mt-1">
          Revisa tus conversaciones pasadas con el Agente Alquimia y los documentos consultados.
        </p>
      </header>

      <div className="space-y-4">
        <div className="card-lms flex items-center justify-between p-5 bg-white border border-slate-100 rounded-2xl shadow-sm">
          <div>
            <h3 className="font-bold text-slate-800">Pregunta: Ciclo de Krebs</h3>
            <p className="text-xs text-slate-500">Ayer, 18:45 • Basado en UD04</p>
          </div>
          <button className="text-medical-green-600 text-xs font-bold uppercase hover:underline">
            Ver Chat
          </button>
        </div>

        <div className="card-lms flex items-center justify-between p-5 bg-white border border-slate-100 rounded-2xl shadow-sm">
          <div>
            <h3 className="font-bold text-slate-800">Lectura: Anatomía Humana</h3>
            <p className="text-xs text-slate-500">Lunes, 10:20 • Página 45-60</p>
          </div>
          <button className="text-medical-green-600 text-xs font-bold uppercase hover:underline">
            Ir al Visor
          </button>
        </div>
      </div>
    </div>
  );
}
