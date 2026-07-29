import './globals.css';
import React from 'react';
import Link from 'next/link';
import SidebarHierarchy from '@/components/SidebarHierarchy';
import ChatDrawer from '@/components/ChatDrawer';
import SidebarCollapseButton from '@/components/SidebarCollapseButton';
import { createClient } from '@/lib/supabase/server';

import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata = {
  title: 'Alquimia LMS - Escuela Online de Nutrición y Dietética',
  description: 'Sistema de Gestión del Aprendizaje impulsado por IA Adaptativa y Micro-learning.',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const navLinks = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Planificación', href: '/planificacion' },
    { name: 'Calendario', href: '/calendario' },
    { name: 'Biblioteca', href: '/biblioteca' },
    { name: 'Evaluación', href: '/evaluacion' },
    { name: 'Historial', href: '/historial' },
    { name: 'Admin', href: '/admin' },
  ];

  return (
    <html lang="es" className={inter.variable}>
      <body className={`h-screen overflow-hidden flex flex-col bg-slate-50 ${inter.className}`}>
        {/* Global Navbar */}
        <nav className="h-16 border-b border-slate-200 bg-white flex items-center px-6 justify-between shrink-0 z-50 shadow-sm relative">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-2xl shadow-sm">
              🏺
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-800 italic">
              Alquimia <span className="text-medical-green-500 not-italic">LMS</span>
            </span>
          </Link>

          <div className="flex items-center gap-6 text-sm font-medium text-slate-500">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-medical-green-600 transition-all relative py-2"
              >
                {link.name}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-medical-green-600 font-bold uppercase tracking-wider">
                  Sesión Activa SSR
                </span>
                <span className="text-xs font-semibold text-slate-900">{user.email}</span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Alumno FP</span>
                  <span className="text-xs font-semibold text-slate-900">User Alquimia</span>
                </div>
                <Link
                  href="/login"
                  className="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-all"
                >
                  Acceso
                </Link>
              </div>
            )}
            <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center text-slate-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
          </div>
        </nav>

        {/* 3-Pane Layout */}
        <main className="flex flex-1 overflow-hidden">
          {/* Left Sidebar */}
          <aside
            id="primary-sidebar"
            className="w-[360px] shrink-0 z-40 shadow-xl shadow-slate-200/50 bg-white flex flex-col relative transition-all duration-500 ease-in-out overflow-visible"
          >
            <SidebarCollapseButton />
            <SidebarHierarchy />
          </aside>

          {/* Center Content */}
          <section className="flex-1 bg-slate-50 flex flex-col overflow-y-auto relative min-w-0">
            {children}
          </section>

          {/* Right AI Drawer */}
          <ChatDrawer />
        </main>
      </body>
    </html>
  );
}
