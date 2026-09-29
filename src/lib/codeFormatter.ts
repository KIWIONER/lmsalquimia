/**
 * Smart markdown, book text, and code preprocessor.
 * Transforms raw text extracted from PDF/OCR by:
 * 1. Translating corrupted bullet + bold asterisks into clean bold items.
 * 2. Elevating corrupted OCR uppercase titles to semantic markdown headings (### Titulo).
 * 3. Removing OCR garbage symbols (orphaned asterisks, page digits, Wingdings bullet glyphs).
 * 4. Splitting unbroken wall-of-text paragraphs into readable, digestable micro-learning chunks.
 * 5. Detecting inline lists and formatting them as real bullet points.
 * 6. Grouping code snippets into dark IDE containers.
 */

export function normalizeCardContent(raw: string): string {
    if (!raw) return "";
    let text = raw.trim();

    // 1. Remove PDF/OCR header/footers & page markers
    text = text.replace(/^[a-zA-Z0-9_-]+\s*·\s*[a-zA-Z0-9_-]+\d*$/gm, "");
    text = text.replace(/^[0-9]+\s*\|\s*Página.*$/gim, "");

    // 2. Convert Wingdings/OCR bullets (□, ■, , ⁃, ∙, etc.) to standard newlines with "- "
    text = text.replace(/[□■▯▮❑❒\uFFFD\uF000-\uF0FF\u2022\u2023\u25E6\u2043\u2219•·⁃]/g, "\n- ");

    // 3. Remove garbage OCR asterisk combinations like "**/**" or "** : **"
    text = text.replace(/\*\*\s*[/\\_-]\s*\*\*/g, "");
    text = text.replace(/\*\*\s*:\s*\*\*/g, ":");

    // 4. Normalize spaces/tabs
    text = text.replace(/[ \t]+/g, " ");

    // 5. Clean up multiple leading dashes on lines: "\n- - " -> "\n- "
    text = text.replace(/(?:^|\n)\s*(?:-\s*)+/g, "\n- ");

    // 6. Fix list item bold prefixes with malformed asterisks & colons:
    // e.g. "- *Equipos de degustación **:" -> "- **Equipos de degustación:** "
    // e.g. "*Equipos de degustación **:" -> "- **Equipos de degustación:** "
    text = text.replace(/(?:^|\n)\s*(?:-\s*)?\*{1,2}\s*([A-Za-z0-9Á-ÿ\s,._/-]+?)\s*\*{1,2}\s*:\s*/g, "\n\n- **$1:** ");

    // 7. Fix inline bold with internal padding or asymmetrical asterisks:
    // e.g. "**pareadas **" -> "**pareadas**"
    // e.g. "*triangulares **" -> "**triangulares**"
    text = text.replace(/\*{1,2}\s*([A-Za-z0-9Á-ÿ,._/-]+(?:\s+[A-Za-z0-9Á-ÿ,._/-]+)*?)\s*\*{1,2}/g, "**$1**");

    // 8. Fix colons with bold:
    // "**word :**" -> "**word:** "
    // "**word** :" -> "**word:** "
    text = text.replace(/\*\*([A-Za-z0-9Á-ÿ\s,._/-]+?)\s*:\s*\*\*/g, "**$1:** ");
    text = text.replace(/\*\*([A-Za-z0-9Á-ÿ\s,._/-]+?)\*\*\s*:\s*/g, "**$1:** ");

    // 9. Ensure a space after bold colon if directly followed by letter: "**word:**letter" -> "**word:** letter"
    text = text.replace(/\*\*:\s*([A-Za-z0-9Á-ÿ])/g, "**: $1");

    // 10. Fix bullet formatting: ensure single space after bullet dash
    text = text.replace(/(?:^|\n)\s*-\s*(\S)/g, "\n- $1");

    // 11. Fix inline dashes after colons or periods: "variantes: - Las" -> "variantes:\n\n- Las"
    text = text.replace(/([.:])\s*-\s+([A-Za-z0-9Á-ÿ])/g, "$1\n\n- $2");

    // 12. Fix stray page numbers or isolated digits between sentences (e.g., "muestras. 3 Las pruebas")
    text = text.replace(/([.!?])\s+\d{1,3}\s+(?=[A-ZÁÉÍÓÚÑ]|-)/g, "$1\n\n");
    text = text.replace(/\s+\d{1,3}\s+(?=-)/g, "\n");

    // 13. Standalone uppercase topic lines: "**HISTORIA DEL APPCC**" -> "### Historia del APPCC"
    text = text.replace(/(?:^|\n)\s*\*+([A-ZÁÉÍÓÚÑ0-9\s,._/-]{3,60}?)\*+\s*(?=\n|$)/g, "\n\n### $1\n");

    // 14. Multiline <style> and <script> blocks to fenced code
    text = text.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_m, code) => {
        return "\n\n```css\n<style>\n" + code.trim() + "\n</style>\n```\n\n";
    });

    text = text.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (_m, code) => {
        return "\n\n```javascript\n<script>\n" + code.trim() + "\n</script>\n```\n\n";
    });

    // 15. Multiline HTML comments
    text = text.replace(/(<!--[\s\S]*?-->)/g, "\n\n```html\n$1\n```\n\n");

    // 16. Group HTML structures into code blocks
    text = text.replace(/((?:<(?:ul|ol|dl|li|dt|dd|table|thead|tbody|tr|td|th|form|nav|div|section|header|footer|video|audio|button|input|img)[^>]*>[\s\S]*?<\/(?:ul|ol|dl|li|dt|dd|table|thead|tbody|tr|td|th|form|nav|div|section|header|footer|video|audio|button)>)+)/gi, (match) => {
        return "\n\n```html\n" + match.trim() + "\n```\n\n";
    });

    // 17. Normalize excessive newlines and spaces
    text = text.replace(/[ \t]+\n/g, "\n");
    text = text.replace(/\n\s*\n\s*\n+/g, "\n\n");

    // 18. Escape remaining standalone HTML tags outside of code blocks into inline code
    const parts = text.split(/(```[\s\S]*?```)/g);
    text = parts.map((part, index) => {
        if (index % 2 === 1) return part;
        return part.replace(/(<(?:!DOCTYPE|[A-Za-z0-9_-]+)[^>]*>|<\/[A-Za-z0-9_-]+>)/g, "`$1`");
    }).join("");

    return text.trim();
}

export function isProgrammingCard(title: string, content: string): boolean {
    const combined = (title + " " + content).toLowerCase();
    const keywords = [
        "html", "css", "javascript", "typescript", "js", "ts", "react", "next",
        "python", "sql", "bash", "código", "codigo", "script", "función", "funcion",
        "api", "endpoint", "component", "props", "hook", "clase", "algoritmo",
        "fcp", "lcp", "dom", "tag", "etiqueta", "atributo", "selector"
    ];
    return keywords.some(k => combined.includes(k));
}
