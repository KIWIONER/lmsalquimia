export interface HighlightItem {
    text: string;
    occurrence?: number;
}

export const applyHighlightsToDOM = (container: HTMLElement | null, highlights: (string | HighlightItem)[]) => {
    if (!container || !highlights || highlights.length === 0) return;

    highlights.forEach((item) => {
        const phrase = typeof item === 'string' ? item : item?.text;
        const occurrence = typeof item === 'string' ? 0 : (item?.occurrence || 0);
        if (!phrase || phrase.length < 1) return;

        // 1. Índice de TODOS los nodos de texto (sin excluir los ya marcados)
        const textNodes: Array<{ node: Node; start: number; end: number }> = [];
        let totalOffset = 0;
        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
        let node: Node | null;
        while ((node = walker.nextNode())) {
            const len = node.textContent?.length || 0;
            textNodes.push({ node, start: totalOffset, end: totalOffset + len });
            totalOffset += len;
        }

        // 2. Texto completo
        const fullText = textNodes.map(t => t.node.textContent || '').join('');
        const lowerFull = fullText.toLowerCase();
        const lowerPhrase = phrase.toLowerCase();

        // 3. Encontrar la ocurrencia N
        let count = 0, matchStart = -1, pos = 0;
        while (true) {
            const idx = lowerFull.indexOf(lowerPhrase, pos);
            if (idx === -1) break;
            if (count === occurrence) { matchStart = idx; break; }
            count++; pos = idx + 1;
        }
        if (matchStart === -1) return;
        const matchEnd = matchStart + phrase.length;

        // 4. Nodos afectados
        const affected = textNodes.filter(t => t.end > matchStart && t.start < matchEnd);
        if (affected.length === 0) return;

        // 5. Aplicar marks en orden inverso (para no desplazar offsets)
        [...affected].reverse().forEach(({ node: n, start: ns }) => {
            const nodeText = n.textContent || '';
            const localStart = Math.max(0, matchStart - ns);
            const localEnd = Math.min(nodeText.length, matchEnd - ns);
            const match = nodeText.slice(localStart, localEnd);
            if (!match) return;

            if (n.parentElement?.tagName === 'MARK') return;

            const before = nodeText.slice(0, localStart);
            const after = nodeText.slice(localEnd);

            const mark = document.createElement('mark');
            mark.style.cssText = 'background-color:#fef08a;color:#000;border-radius:2px;padding:0 2px;';
            mark.textContent = match;

            const parent = n.parentNode;
            if (parent) {
                if (before) parent.insertBefore(document.createTextNode(before), n);
                parent.insertBefore(mark, n);
                if (after) parent.insertBefore(document.createTextNode(after), n);
                parent.removeChild(n);
            }
        });
    });
};

export const clearDOMHighlights = (container: HTMLElement | null) => {
    if (!container) return;
    container.querySelectorAll('mark').forEach(mark => {
        const parent = mark.parentNode;
        if (parent) {
            while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
            parent.removeChild(mark);
        }
    });
    container.normalize();
};
