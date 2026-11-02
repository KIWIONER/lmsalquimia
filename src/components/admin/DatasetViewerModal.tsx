'use client';

import React, { useState, useEffect } from 'react';

interface DatasetViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  asignatura?: string;
  unit?: string;
}

export default function DatasetViewerModal({
  isOpen,
  onClose,
  asignatura = 'alimentacion-equilibrada',
  unit: initialUnit = 'UD1'
}: DatasetViewerModalProps) {
  const [selectedUnit, setSelectedUnit] = useState(initialUnit);
  const [activeTab, setActiveTab] = useState<'chatml' | 'rag' | 'diff' | 'manifest'>('chatml');
  const [loading, setLoading] = useState(false);
  const [datasetData, setDatasetData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/datasets?asignatura=${asignatura}&unit=${selectedUnit}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error && !data.availableUnits) setError(data.error);
        else setDatasetData(data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [isOpen, asignatura, selectedUnit]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
        {/* Cabecera del Modal */}
        <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            <span className="text-2xl">🤖</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-800 tracking-tight">
                  Inspector de Datasets ML & Cerebro
                </h2>
                {/* Selector Desplegable de Unidad */}
                {datasetData?.availableUnits && datasetData.availableUnits.length > 0 && (
                  <select
                    value={selectedUnit}
                    onChange={(e) => setSelectedUnit(e.target.value)}
                    className="ml-2 bg-white border border-slate-200 rounded-xl px-3 py-1 text-xs font-black text-medical-green-700 shadow-xs outline-none cursor-pointer hover:border-medical-green-500 transition-all"
                  >
                    {datasetData.availableUnits.map((u: string) => (
                      <option key={u} value={u}>
                        {u === 'consolidated' ? '🏆 Asignatura Completa (Consolidada)' : `📖 ${u}`}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {asignatura} &gt; {selectedUnit}
              </p>
            </div>
          </div>

          {/* Selector de Pestañas */}
          <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('chatml')}
              className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${
                activeTab === 'chatml' ? 'bg-white text-medical-green-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              💎 Pares ChatML ({datasetData?.counts?.chatml ?? 0})
            </button>
            <button
              onClick={() => setActiveTab('rag')}
              className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${
                activeTab === 'rag' ? 'bg-white text-medical-green-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🧩 Chunks RAG ({datasetData?.counts?.rag ?? 0})
            </button>
            {selectedUnit !== 'consolidated' && (
              <button
                onClick={() => setActiveTab('diff')}
                className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${
                  activeTab === 'diff' ? 'bg-white text-medical-green-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🌐 Gallego vs Castellano
              </button>
            )}
            <button
              onClick={() => setActiveTab('manifest')}
              className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${
                activeTab === 'manifest' ? 'bg-white text-medical-green-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📊 Manifest
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold transition-all"
          >
            ✕
          </button>
        </div>

        {/* Cuerpo con Scroll */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
          {loading && (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
              <div className="w-8 h-8 border-4 border-medical-green-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-bold uppercase tracking-wider">Cargando datasets reales ({selectedUnit})...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-2xl text-sm">
              {error}
            </div>
          )}

          {!loading && !error && datasetData && (
            <>
              {/* TAB 1: PARES CHATML */}
              {activeTab === 'chatml' && (
                <div className="space-y-6">
                  {datasetData.data.chatmlPairs.map((pair: any, idx: number) => {
                    const question = pair.messages?.find((m: any) => m.role === 'user')?.content;
                    const answer = pair.messages?.find((m: any) => m.role === 'assistant')?.content;
                    return (
                      <div key={idx} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-black uppercase tracking-widest bg-medical-green-50 text-medical-green-700 px-3 py-1 rounded-full border border-medical-green-100">
                            Par #{idx + 1} • {pair.metadata?.seccion || 'Sección'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            SHA: {pair.metadata?.content_sha256?.slice(0, 12)}...
                          </span>
                        </div>
                        <div className="mb-4">
                          <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Pregunta del Alumno:</p>
                          <p className="text-sm font-bold text-slate-800 bg-slate-50 p-3 rounded-xl border border-slate-100">
                            {question}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-black text-medical-green-600 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                            <span>👨‍⚕️</span> Respuesta del Profesor Alquimia:
                          </p>
                          <div className="text-xs text-slate-600 leading-relaxed bg-white p-4 rounded-xl border border-medical-green-100 whitespace-pre-wrap">
                            {answer}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 2: CHUNKS RAG */}
              {activeTab === 'rag' && (
                <div className="space-y-4">
                  {datasetData.data.ragChunks.map((chunk: any, idx: number) => (
                    <div key={idx} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-700 font-mono">
                          ID: {chunk.id}
                        </span>
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
                          {chunk.metadata?.num_palabras} palabras • Págs {chunk.pagina_inicio}-{chunk.pagina_fin}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-slate-400 mb-3">
                        Parent ID: {chunk.parent_id}
                      </p>
                      <div className="text-xs text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100 font-mono whitespace-pre-wrap">
                        {chunk.text_for_embedding}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 3: DIFF LINGÜÍSTICO */}
              {activeTab === 'diff' && selectedUnit !== 'consolidated' && (
                <div className="space-y-6">
                  {datasetData.data.esRecords?.map((esRec: any, idx: number) => {
                    const rawRec = datasetData.data.rawRecords?.[idx];
                    return (
                      <div key={idx} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                            Página {esRec.pagina_inicio} • {esRec.seccion}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                              Original Gallego (Libro)
                            </span>
                            <div className="mt-2 text-xs text-slate-600 bg-amber-50/20 p-4 rounded-xl border border-amber-100 h-64 overflow-y-auto whitespace-pre-wrap">
                              {rawRec?.contenido_markdown || 'No disponible'}
                            </div>
                          </div>
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-medical-green-700 bg-medical-green-50 px-2.5 py-1 rounded-md border border-medical-green-200">
                              Normalizado Castellano (ML Ready)
                            </span>
                            <div className="mt-2 text-xs text-slate-700 bg-medical-green-50/20 p-4 rounded-xl border border-medical-green-100 h-64 overflow-y-auto whitespace-pre-wrap">
                              {esRec.contenido_markdown}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 4: MANIFEST */}
              {activeTab === 'manifest' && (
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                  <pre className="text-xs font-mono text-slate-700 bg-slate-50 p-6 rounded-xl border border-slate-100 overflow-x-auto">
                    {JSON.stringify(datasetData.manifest, null, 2)}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
