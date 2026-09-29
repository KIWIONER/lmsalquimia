import React, { useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";

interface CodeBlockProps {
    language?: string;
    value: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ language = "código", value }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            console.error("Failed to copy", e);
        }
    };

    const highlightSyntax = (code: string, lang: string) => {
        const cleanLang = (lang || "").toLowerCase();
        
        let escaped = code
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        if (cleanLang === "html" || cleanLang === "xml") {
            // HTML comments
            escaped = escaped.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="text-slate-500 italic">$1</span>');
            // Tag names
            escaped = escaped.replace(/(&lt;\/?)([a-zA-Z0-9_-]+)/g, '$1<span class="text-sky-400 font-bold">$2</span>');
            // Attributes
            escaped = escaped.replace(/\s([a-zA-Z0-9_-]+)=/g, ' <span class="text-emerald-400">$1</span>=');
            // Strings
            escaped = escaped.replace(/("[^"]*"|\'[^\']*\')/g, '<span class="text-amber-300">$1</span>');
            // Closing brackets
            escaped = escaped.replace(/(&gt;)/g, '<span class="text-slate-400">$1</span>');
        } else if (cleanLang === "css") {
            // CSS comments
            escaped = escaped.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="text-slate-500 italic">$1</span>');
            // Selectors
            escaped = escaped.replace(/^([^\{\n]+)\{/gm, '<span class="text-emerald-400 font-bold">$1</span>{');
            // Properties
            escaped = escaped.replace(/([a-zA-Z-]+)(\s*:)/g, '<span class="text-sky-400">$1</span>$2');
            // Values
            escaped = escaped.replace(/(:\s*)([^;\}\n]+)/g, '$1<span class="text-amber-300">$2</span>');
        } else {
            // JS / TS / Python / Bash
            escaped = escaped.replace(/(\/\/.*$|#.*$)/gm, '<span class="text-slate-500 italic">$1</span>');
            escaped = escaped.replace(/\b(const|let|var|function|return|import|export|from|default|class|if|else|async|await|try|catch|def|for|while|in|is|None|True|False)\b/g, '<span class="text-purple-400 font-bold">$1</span>');
            escaped = escaped.replace(/("[^"]*"|\'[^\']*\'|\`[^\`]*\`)/g, '<span class="text-amber-300">$1</span>');
            escaped = escaped.replace(/\b(\d+)\b/g, '<span class="text-emerald-400">$1</span>');
        }

        return escaped;
    };

    return (
        <div className="my-4 rounded-xl overflow-hidden border border-slate-800 bg-[#0d1117] text-slate-100 shadow-xl font-mono text-xs sm:text-sm not-prose">
            {/* Header del Bloque de Código */}
            <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-slate-800/80 select-none">
                <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                    </div>
                    <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider ml-1.5 flex items-center gap-1">
                        <Terminal size={12} />
                        {language || "código"}
                    </span>
                </div>

                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700/80 transition-all"
                    title="Copiar código"
                >
                    {copied ? (
                        <>
                            <Check size={12} className="text-emerald-400" />
                            <span className="text-emerald-400">¡Copiado!</span>
                        </>
                    ) : (
                        <>
                            <Copy size={12} />
                            <span>Copiar</span>
                        </>
                    )}
                </button>
            </div>

            {/* Código Resaltado */}
            <pre className="p-4 overflow-x-auto text-xs sm:text-sm leading-relaxed text-slate-200 font-mono">
                <code
                    dangerouslySetInnerHTML={{ __html: highlightSyntax(value, language) }}
                />
            </pre>
        </div>
    );
};
