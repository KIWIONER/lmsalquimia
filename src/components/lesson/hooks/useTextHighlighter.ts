import { useState, useEffect, useRef } from 'react';
import { useChatStore } from '../../../store/chatStore';
import { applyHighlightsToDOM, clearDOMHighlights, HighlightItem } from '../utils/domHighlight';
import { LessonBlock } from './useLessonCards';

export const useTextHighlighter = (blocks: LessonBlock[]) => {
    const { cardHighlights, setCardHighlights } = useChatStore();
    const [highlightModeCardId, setHighlightModeCardId] = useState<string | number | null>(null);
    const contentRefs = useRef<Record<string | number, HTMLElement | null>>({});

    const handleHighlightToggle = (blockId: string | number) => {
        setHighlightModeCardId(prev => (prev === blockId ? null : blockId));
    };

    const handleContentMouseUp = (block: LessonBlock, e: React.MouseEvent<HTMLDivElement>) => {
        if (highlightModeCardId !== block.id) return;
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const selectedText = selection.toString().trim();
        if (!selectedText || selectedText.length < 2) return;

        let occurrence = 0;
        try {
            const range = selection.getRangeAt(0);
            const contentDiv = e.currentTarget;
            const preRange = document.createRange();
            preRange.selectNodeContents(contentDiv);
            preRange.setEnd(range.startContainer, range.startOffset);
            const textBefore = preRange.toString().toLowerCase();
            const lowerPhrase = selectedText.toLowerCase();
            let pos = 0;
            while (true) {
                const found = textBefore.indexOf(lowerPhrase, pos);
                if (found === -1) break;
                occurrence++;
                pos = found + 1;
            }
        } catch (err) {
            console.warn('Could not calculate selection occurrence offset:', err);
        }

        const existing: (string | HighlightItem)[] = (cardHighlights[block.id] || []) as any;
        const newItem: string | HighlightItem = occurrence > 0 ? { text: selectedText, occurrence } : selectedText;
        
        const isDuplicate = existing.some(item => {
            const text = typeof item === 'string' ? item : item.text;
            const occ = typeof item === 'string' ? 0 : (item.occurrence || 0);
            return text === selectedText && occ === occurrence;
        });

        if (!isDuplicate) {
            setCardHighlights(String(block.id), [...existing, newItem as any]);
        }
        selection.removeAllRanges();
    };

    useEffect(() => {
        blocks.forEach(block => {
            const container = contentRefs.current[block.id];
            const highlights = cardHighlights[block.id];
            if (container) {
                clearDOMHighlights(container);
                if (highlights && highlights.length > 0) {
                    applyHighlightsToDOM(container, highlights);
                }
            }
        });
    }, [cardHighlights, blocks]);

    return {
        highlightModeCardId,
        handleHighlightToggle,
        handleContentMouseUp,
        contentRefs
    };
};
