'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();

  const supabase = createClient();

  const signInWithEmail = async (targetEmail: string, targetPassword: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // Asegurar que cualquier sesión previa de profesor/admin quede cerrada al entrar como alumno
      await fetch('/api/admin/auth/logout', { method: 'POST' }).catch(() => {});
      const { error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: targetPassword,
      });
      if (error) throw error;
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error en la autenticación');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    await signInWithEmail(email, password);
  };

  return (
    <div className="min-h-full flex items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-medical-green-50 border border-medical-green-100 text-2xl rounded-2xl flex items-center justify-center mx-auto shadow-sm">
            🏺
          </div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">
            Acceso a Alquimia LMS
          </h1>
          <p className="text-xs text-slate-400">
            Inicia sesión con tu cuenta o entra en Modo Demo
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold rounded-xl text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">
              Correo Electrónico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-medical-green-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-medical-green-500 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-medical-green-500 hover:bg-medical-green-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-medical-green-500/20 transition-all disabled:opacity-50"
          >
            {loading ? 'Procesando...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800">
              Modo Demo — Alumno
            </span>
            <span className="text-[10px] font-semibold text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
              Lectura y Evaluaciones
            </span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            Usuario: <code className="font-mono font-semibold text-slate-800">demo.alumno@alquimia.es</code><br />
            Clave: <code className="font-mono font-semibold text-slate-800">DemoAlumno2026!</code>
          </p>
          <button
            type="button"
            disabled={loading}
            onClick={() => signInWithEmail('demo.alumno@alquimia.es', 'DemoAlumno2026!')}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-50"
          >
            Entrar como Alumno Demo
          </button>
        </div>

        <p className="text-[11px] text-center text-slate-400 pt-2 border-t border-slate-100">
          El registro de nuevas cuentas está deshabilitado temporalmente.
        </p>
      </div>
    </div>
  );
}
