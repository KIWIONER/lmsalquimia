'use client';

import React, { useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useUIStore } from '../store/uiStore';

interface SidebarCollapseButtonProps {
    hideButton?: boolean;
}

const SidebarCollapseButton: React.FC<SidebarCollapseButtonProps> = ({ hideButton = false }) => {
    const { isLeftSidebarOpen, toggleLeftSidebar } = useUIStore();

    useEffect(() => {
        const sidebar = document.getElementById('primary-sidebar');
        if (sidebar) {
            if (isLeftSidebarOpen) {
                sidebar.style.width = '360px';
                sidebar.style.minWidth = '360px';
                sidebar.classList.remove('sidebar-collapsed');
            } else {
                sidebar.style.width = '64px';
                sidebar.style.minWidth = '64px';
                sidebar.classList.add('sidebar-collapsed');
            }
        }
    }, [isLeftSidebarOpen]);

    if (hideButton) return null;

    return (
        <button 
            onClick={toggleLeftSidebar}
            className={`absolute top-4 -right-4 w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-400 hover:text-medical-green-600 transition-all z-[60] hover:scale-105 active:scale-95`}
            style={{ pointerEvents: 'auto' }}
            title={isLeftSidebarOpen ? "Colapsar Menú Principal" : "Expandir Menú Principal"}
        >
            {isLeftSidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
    );
};

export default SidebarCollapseButton;
