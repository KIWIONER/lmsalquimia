/**
 * SHARED CONTENT LOGIC
 * Used by DocumentEditor (Admin) and LessonContentViewer (Student)
 */

export const isIndexTitle = (line: string): boolean => {
    const t = line.trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[:\s]+$/, '');
    return (
        t === 'indice' || t === 'indices' || t === 'tabla de contenidos' || 
        t === 'tabla de contenido' || t === 'taboa de contidos' || 
        t === 'taboa de contido' || t === 'table of contents' || 
        t === 'contenidos' || t === 'contidos' || t === 'sumario' || 
        t === 'summary' || t === 'indice de contenidos' || t === 'indice de contidos'
    );
};

export const isIndexLine = (line: string): boolean => {
    const t = line.trim();
    if (!t) return true;
    if (t.includes('....') || t.includes('...')) return true;
    if (/^\d+(\.\d+)*\s+[A-Za-zÁ-ÿ]/.test(t) && /\d+$/.test(t)) return true;
    return false;
};

export const isSectionHeader = (line: string): boolean => {
    const t = line.trim();
    if (!t) return false;
    if (/^\d+$/.test(t)) return false;
    if (t.includes('....') || t.includes('...')) return false;

    // Markdown headers
    if (/^#{1,4}\s+[A-Za-z0-9Á-ÿ]/.test(t)) return true;

    // Unit / Chapter / Topic patterns
    if (/^(?:UNIDADE|UNIDAD|CAPÍTULO|CAPITULO|TEMA|MÓDULO|MODULO|BLOQUE|SECCIÓN|SECCION|PARTE|LECCIÓN|LECCION|UD\s*\d*|UD\.\s*\d*)\b/i.test(t)) return true;

    // Numbered headings: 1. Title, 1.1 Title, 01 - Title, 1) Title, I. Title
    if (/^(?:\d{1,2}(?:\.\d{1,2}){0,3}[.)\-]?|\d{1,2}\s*[-–—]|\b[IVXLCDM]+\.)\s+[A-ZÁÉÍÓÚÑ]/.test(t)) return true;

    // Standalone bold header: **Titulo**
    if (/^\*\*[A-ZÁÉÍÓÚÑ][^*]{2,60}\*\*$/.test(t)) return true;

    // All uppercase line (4 to 50 chars, no terminal punctuation)
    if (t === t.toUpperCase() && t.length >= 4 && t.length <= 50 && /[A-ZÁÉÍÓÚÑ]/.test(t) && !/[.,:;]$/.test(t)) {
        return true;
    }

    return false;
};

export interface ContentBlock {
    id: number;
    title: string;
    content: string;
}

export const cleanTitle = (raw: string, defaultTitle: string): string => {
    const cleaned = raw
        .trim()
        .replace(/^[-*#\s_]+/, '')
        .replace(/[-*#\s_]+$/, '')
        .trim();
    return cleaned || defaultTitle;
};

/**
 * Preprocesses raw text extracted from PDF or OCR:
 * - Unpacks merged headings from body paragraphs
 * - Converts OCR artifact titles to standard Markdown ## headers
 */
export function preprocessPdfText(raw: string): string {
    if (!raw) return "";
    let text = raw;

    // 1. Separate inline numbered headers merged with text like:
    // "- *2.1. Alteraciones físicas de los alimentos **Las alteraciones..."
    // "- *2. ALTERACIONES DE LOS ALIMENTOS**"
    text = text.replace(/(?:^|\n)\s*(?:[-*#_>\s]*)\*?(\d{1,2}(?:\.\d{1,2}){0,3}[.)\-]?\s+[A-ZÁÉÍÓÚÑ][^*\n]{2,70}?)\*?\*\*\s*([A-ZÁÉÍÓÚÑa-zá-ÿ])/g, "\n\n## $1\n$2");
    text = text.replace(/(?:^|\n)\s*(?:[-*#_>\s]*)\*?(\d{1,2}(?:\.\d{1,2}){0,3}[.)\-]?\s+[A-ZÁÉÍÓÚÑ][^*\n]{2,70}?)\*?\*\*\s*(?=\n|$)/g, "\n\n## $1\n");

    // 2. Standalone topic with bold asterisk: "- *Luz**" -> "### Luz"
    text = text.replace(/(?:^|\n)\s*(?:[-*#_>\s]*)\*([A-ZÁÉÍÓÚÑ][A-Za-z0-9Á-ÿ\s,._/-]{2,40}?)\*\*\s*([A-ZÁÉÍÓÚÑa-zá-ÿ])/g, "\n\n### $1\n$2");
    text = text.replace(/(?:^|\n)\s*(?:[-*#_>\s]*)\*([A-ZÁÉÍÓÚÑ][A-Za-z0-9Á-ÿ\s,._/-]{2,40}?)\*\*\s*(?=\n|$)/g, "\n\n### $1\n");

    // 3. Standard numbered headings on standalone lines
    text = text.replace(/(?:^|\n)\s*(\d{1,2}(?:\.\d{1,2}){1,3}\.?\s+[A-ZÁÉÍÓÚÑ][^\n.!?]{3,60})(?=\n|$)/g, "\n\n## $1\n");

    return text;
}

/**
 * Subdivides any oversized block (> 3000 chars) into digestible micro-learning cards
 * guaranteeing 100% of characters are preserved without truncation, even from unbroken walls of text.
 */
export function splitLargeBlock(title: string, content: string, maxLen = 3000): Array<{ title: string; content: string }> {
    if (!content || content.length <= maxLen) return [{ title, content: content || "" }];

    // 1. Break into sentences / paragraphs
    const paragraphs = content.split(/\n\s*\n+/);
    const atomics: string[] = [];

    for (const p of paragraphs) {
        if (p.length <= maxLen) {
            atomics.push(p);
        } else {
            // Split huge single paragraph by sentences
            const sentences = p.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [p];
            let sChunk = "";
            for (const s of sentences) {
                if ((sChunk + " " + s).length > maxLen && sChunk.length > 300) {
                    atomics.push(sChunk.trim());
                    sChunk = s;
                } else {
                    sChunk = sChunk ? `${sChunk} ${s}` : s;
                }
            }
            if (sChunk.trim()) atomics.push(sChunk.trim());
        }
    }

    const subBlocks: Array<{ title: string; content: string }> = [];
    let curText = "";
    let partNum = 1;

    for (const a of atomics) {
        if ((curText + "\n\n" + a).length > maxLen && curText.length > 300) {
            subBlocks.push({
                title: `${title} (Parte ${partNum})`,
                content: curText.trim()
            });
            partNum++;
            curText = a;
        } else {
            curText = curText ? `${curText}\n\n${a}` : a;
        }
    }

    if (curText.trim()) {
        subBlocks.push({
            title: partNum > 1 ? `${title} (Parte ${partNum})` : title,
            content: curText.trim()
        });
    }

    return subBlocks.length > 0 ? subBlocks : [{ title, content }];
}

/**
 * Splits raw markdown or PDF extracted text into structured blocks (cards)
 * preserving 100% of the content.
 */
export const splitIntoBlocks = (rawText: string): ContentBlock[] => {
    if (!rawText || !rawText.trim()) return [{ id: 1, title: 'Inicio', content: '' }];

    const text = preprocessPdfText(rawText);
    let rawBlocks: Array<{ title: string; content: string }> = [];

    if (text.includes('## ') || text.includes('### ')) {
        const parts = text.split(/^#{2,3}\s+/m);
        for (let i = 0; i < parts.length; i++) {
            const block = parts[i];
            if (!block.trim()) continue;
            const lines = block.split('\n');
            if (i === 0 && !text.startsWith('## ') && !text.startsWith('### ')) {
                rawBlocks.push({
                    title: 'Introducción',
                    content: block.trim()
                });
            } else {
                const rawTitle = lines[0] || '';
                const title = cleanTitle(rawTitle, `Sección ${i}`);
                const content = lines.slice(1).join('\n').trim();
                rawBlocks.push({ title, content });
            }
        }
    } else {
        const lines = text.split('\n');
        let curTitle: string | null = null;
        let curLines: string[] = [];
        let inIndex = false;

        const push = () => {
            const body = curLines.join('\n').trim();
            if (curTitle || body) {
                rawBlocks.push({
                    title: cleanTitle(curTitle || '', rawBlocks.length === 0 ? 'Introducción' : `Sección ${rawBlocks.length + 1}`),
                    content: body
                });
            }
            curTitle = null;
            curLines = [];
        };

        for (const line of lines) {
            if (isIndexTitle(line)) {
                push();
                curTitle = line.trim();
                inIndex = true;
            } else if (inIndex && isIndexLine(line)) {
                curLines.push(line);
            } else if (inIndex && !isIndexLine(line)) {
                inIndex = false;
                push();
                if (isSectionHeader(line)) curTitle = line.trim();
                else curLines = [line];
            } else if (!inIndex && isSectionHeader(line)) {
                push();
                curTitle = line.trim();
            } else {
                curLines.push(line);
            }
        }
        push();
    }

    // Merge empty heading-only blocks into the next block to avoid 0-character cards
    const mergedBlocks: Array<{ title: string; content: string }> = [];
    let pendingTitle: string | null = null;

    for (let i = 0; i < rawBlocks.length; i++) {
        const b = rawBlocks[i];
        if (!b.content && i < rawBlocks.length - 1) {
            pendingTitle = pendingTitle ? `${pendingTitle}: ${b.title}` : b.title;
        } else {
            const title = pendingTitle ? `${pendingTitle}: ${b.title}` : b.title;
            pendingTitle = null;
            mergedBlocks.push({ title, content: b.content });
        }
    }

    if (pendingTitle && mergedBlocks.length > 0) {
        mergedBlocks[mergedBlocks.length - 1].title += `: ${pendingTitle}`;
    }

    // Subdivide oversized blocks (> 3000 chars) ensuring zero truncation
    const finalBlocks: ContentBlock[] = [];
    for (const b of mergedBlocks) {
        const sub = splitLargeBlock(b.title, b.content);
        for (const s of sub) {
            finalBlocks.push({
                id: finalBlocks.length + 1,
                title: s.title,
                content: s.content
            });
        }
    }

    return finalBlocks.length > 0 ? finalBlocks : [{ id: 1, title: 'Contenido', content: rawText.trim() }];
};

export const joinBlocks = (blocks: ContentBlock[]): string =>
    blocks.map((b: ContentBlock) => `## ${b.title}\n${b.content}`).join('\n\n');

export const toKebabCase = (str: string): string => {
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-/]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
};
