'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const router = useRouter();

  const supabase = createClient();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        alert('¡Registro completado! Revisa tu email para confirmar la cuenta.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error en la autenticación');
    } finally {
      setLoading(false);
    }
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
            {isSignUp ? 'Crea tu cuenta de estudiante FP' : 'Inicia sesión con Supabase Auth SSR'}
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
            {loading ? 'Procesando...' : isSignUp ? 'Registrarme' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-400">
            {isSignUp ? '¿Ya tienes cuenta?' : '¿Nuevo estudiante?'}
          </span>
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="font-bold text-medical-green-600 hover:underline"
          >
            {isSignUp ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </button>
        </div>
      </div>
    </div>
  );
}
