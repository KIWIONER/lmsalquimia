import React from 'react';
import ChatSidebar from './ChatSidebar.jsx';
import { Minus, Brain } from 'lucide-react';
import { useChatStore } from '../store/chatStore';

const FloatingChat = () => {
  const { isOpen, closeChat } = useChatStore();

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[1000] flex flex-col items-end">
      {/* Ventana de Chat */}
      <div className="mb-4 w-96 h-[50vh] bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-in slide-in-from-bottom-10 fade-in duration-300">
        {/* Header del Chat Flotante */}
        <div className="h-14 px-6 bg-slate-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-medical-green-500 rounded-xl flex items-center justify-center text-white">
              <Brain size={16} />
            </div>
            <span className="text-xs font-black text-white uppercase tracking-widest">Asistente <span className="text-medical-green-400 italic">IA</span></span>
          </div>
          <div className="flex gap-1">
              <button 
              onClick={closeChat}
              className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-all"
              title="Minimizar"
              >
              <Minus size={18} />
              </button>
          </div>
        </div>

        {/* El componente de Chat original encapsulado */}
        <div className="flex-1 overflow-hidden">
          <ChatSidebar />
        </div>
      </div>
    </div>
  );
};

export default FloatingChat;
