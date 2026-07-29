'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BookOpen, Brain, CalendarDays, User } from 'lucide-react';

export default function BottomNavigation() {
  const pathname = usePathname();

  const navItems = [
    { name: 'Inicio', href: '/dashboard', icon: Home },
    { name: 'Biblioteca', href: '/biblioteca', icon: BookOpen },
    { name: 'Tests', href: '/evaluacion', icon: Brain },
    { name: 'Plan', href: '/planificacion', icon: CalendarDays },
    { name: 'Perfil', href: '/historial', icon: User },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 px-2 pb-safe shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = pathname?.startsWith(item.href) || false;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center w-16 h-full space-y-1 touch-target relative group"
            >
              <div
                className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 ${
                  isActive
                    ? 'bg-medical-green-50 text-medical-green-600'
                    : 'text-slate-400 group-hover:text-slate-600'
                }`}
              >
                <Icon size={isActive ? 22 : 20} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span
                className={`text-[9px] font-medium tracking-tight transition-colors ${
                  isActive ? 'text-medical-green-600 font-bold' : 'text-slate-400'
                }`}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
