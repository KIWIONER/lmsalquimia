import React from 'react';
import { Brain } from 'lucide-react';
import { useChatStore } from '../store/chatStore';

const AIStudyButton = ({ variant = 'black' }) => {
  const { toggleChat, isOpen } = useChatStore();

  const styles = {
    black: isOpen ? "bg-medical-green-600 text-white shadow-medical-green-600/40 scale-[1.02]" : "bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/10",
    green: "bg-medical-green-600 hover:bg-medical-green-700 text-white shadow-medical-green-600/20"
  };

  return (
    <button 
      onClick={toggleChat}
      className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 ${styles[variant]}`}
    >
      <Brain size={16} className={isOpen ? 'animate-pulse' : ''} />
      {isOpen ? 'Cerrar Agente' : 'Estudia con IA'}
    </button>
  );
};

export default AIStudyButton;
