import './globals.css';
import React from 'react';
import AppShell from '@/components/AppShell';
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

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={inter.variable}>
      <body className={inter.className}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
