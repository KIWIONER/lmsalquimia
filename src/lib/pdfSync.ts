/**
 * PDF Sync & Anchor Extraction Utility
 * Calculates search anchors and distinctive snippets from lesson cards
 * to locate and highlight matching passages in the original PDF document.
 */

export interface CardSearchAnchor {
    searchSnippet: string;
    cleanTitle: string;
    firstSentence: string;
    keywords: string[];
}

/**
 * Extracts a distinctive 4-7 word snippet from a card for search and highlighting
 */
export function extractCardSearchAnchor(title: string, content: string): CardSearchAnchor {
    const cleanT = (title || "")
        .replace(/^[-*#\s_]+/, "")
        .replace(/[-*#\s_]+$/, "")
        .replace(/\(Parte\s+\d+\)/gi, "")
        .replace(/^\d+(\.\d+)*\s*/, "")
        .trim();

    // Clean content of markdown and html tags
    const cleanC = (content || "")
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/[*#_`~>[\]()]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    // Find the first meaningful sentence (> 15 chars)
    const sentences = cleanC.match(/[^.!?]+[.!?]+(?:\s+|$)/g) || [cleanC];
    const firstSentence = sentences.find(s => s.trim().length > 15)?.trim() || cleanT || "Contenido";

    // Extract 4-6 most distinctive consecutive words
    const words = firstSentence
        .split(/\s+/)
        .filter(w => w.length > 2 && !/^(el|la|los|las|un|una|unos|unas|de|del|a|en|por|para|con|sin|sobre|que|se|es|son|como)$/i.test(w));

    const keywords = words.slice(0, 6);
    const searchSnippet = keywords.length >= 2 
        ? keywords.slice(0, 4).join(" ") 
        : (cleanT.slice(0, 30) || "Introducción");

    return {
        searchSnippet,
        cleanTitle: cleanT,
        firstSentence: firstSentence.slice(0, 160),
        keywords
    };
}

/**
 * Builds a browser-compatible PDF URL with search and highlight parameters
 */
export function buildPdfViewerUrl(pdfUrl: string, searchSnippet?: string, pageNumber?: number): string {
    if (!pdfUrl) return "";
    
    // Remove existing hash
    const baseUrl = pdfUrl.split("#")[0];
    const params: string[] = [];

    if (pageNumber && pageNumber > 0) {
        params.push(`page=${pageNumber}`);
    }

    if (searchSnippet && searchSnippet.trim()) {
        const encodedSearch = encodeURIComponent(searchSnippet.trim());
        params.push(`search="${encodedSearch}"`);
        params.push(`phrase=true`);
    }

    // Default zoom
    params.push("zoom=page-fit");

    return `${baseUrl}#${params.join("&")}`;
}
