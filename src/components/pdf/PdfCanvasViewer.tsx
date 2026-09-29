'use client';

import React, { useEffect, useRef, useState, useCallback, memo } from "react";
import { 
    Loader2, 
    ZoomIn, 
    ZoomOut, 
    Search, 
    AlertCircle,
    Focus
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";

// Configurar Worker de PDF.js
if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

interface PageTextItem {
    str: string;
    x: number;
    y: number;
    width: number;
    height: number;
    startChar: number;
    endChar: number;
}

interface PageData {
    pageNumber: number;
    items: PageTextItem[];
    fullText: string;
    originalWidth: number;
    originalHeight: number;
}

export interface GlobalHighlight {
    startPage: number;
    endPage: number;
    startUnscaledY: number;
    endUnscaledBottom: number;
    minX: number;
    maxX: number;
    pageWidth: number;
    top: number;
    left: number;
    width: number;
    height: number;
}

interface PdfCanvasViewerProps {
    pdfUrl: string;
    cardTitle?: string;
    cardContent?: string;
    cardIndex?: number;
    enableHighlight?: boolean;
    onToggleHighlight?: (enabled: boolean) => void;
    onTextFound?: (pageNumber: number) => void;
    className?: string;
}

function normalizeSearchText(str: string): string {
    if (!str) return "";
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function getCleanTitle(title?: string) {
    if (!title) return { normTitle: "", normTitleWithoutNum: "", baseTitle: "" };
    // Eliminar sufijos automáticos de división como (Parte 1), (Parte 2), etc.
    const base = title.replace(/\s*\(\s*parte\s*\d+\s*\)/gi, '').trim();
    const normTitle = normalizeSearchText(base);
    const normTitleWithoutNum = normTitle.replace(/^[0-9\.\s]+/, '').trim();
    return { normTitle, normTitleWithoutNum, baseTitle: base };
}



function isIndexTitle(line?: string): boolean {
    if (!line) return false;
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
}

function isTocPage(pageData: PageData): boolean {
    if (pageData.pageNumber > 6) return false;
    const norm = normalizeSearchText(pageData.fullText);
    if (
        norm.includes('taboa de contidos') || 
        norm.includes('tabla de contenidos') || 
        norm.includes('indice') || 
        norm.includes('sumario') ||
        norm.includes('table of contents')
    ) {
        return true;
    }
    // Detección por líneas de puntos guía del índice (e.g. "..... 59", ". . . 61")
    const dotMatches = (pageData.fullText.match(/\.{3,}|\s\.\s\.\s|\.{2,}\s*\d+/g) || []).length;
    if (dotMatches >= 3) return true;

    // Detección por alta proporción de líneas que terminan en número de página
    const lines = pageData.fullText.split('\n');
    let pageNumLines = 0;
    for (const line of lines) {
        if (/\.{2,}\s*\d{1,3}$|\s{3,}\d{1,3}$/.test(line.trim())) {
            pageNumLines++;
        }
    }
    if (pageNumLines >= 3) return true;

    return false;
}

function isIgnoredPageFooterOrArtifact(item: PageTextItem, pageHeight?: number): boolean {
    if (!item.str) return true;
    const s = item.str.trim();
    if (!s) return true;

    // 1. URLs y direcciones web (excluir enlaces al pie de página)
    if (/https?:\/\/|www\.|\.php\b|\.html?\b|\/centros\/|\/aulavirtual\/|\.gal\b|\.es\/|\.com\//i.test(s)) {
        return true;
    }

    // 2. Fechas de impresión en márgenes
    if (/^\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}(?:,\s*\d{1,2}:\d{2})?/.test(s)) {
        return true;
    }

    // 3. Paginación aislada
    if (/^\d{1,3}\s*\/\s*\d{1,3}$/.test(s)) return true;
    if (/^(página|páxina|pag\.|pág\.)\s*\d+/i.test(s)) return true;

    // 4. Margen inferior extremo (últimos 42px)
    if (pageHeight && pageHeight > 0 && item.y > pageHeight - 42) {
        if (/https?|xunta|gal|print|index|edu|fp|\d+\/\d+|\d+/i.test(s)) {
            return true;
        }
    }

    return false;
}

// Subcomponente memoizado para renderizar cada página del PDF
const PdfPageItem = memo(({
    pageNum,
    pdfDoc,
    scale,
    pageData
}: {
    pageNum: number;
    pdfDoc: any;
    scale: number;
    pageData?: PageData;
}) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const renderTaskRef = useRef<any>(null);

    useEffect(() => {
        let isCancelled = false;

        async function renderPage() {
            if (!pdfDoc || !canvasRef.current) return;

            try {
                if (renderTaskRef.current) {
                    try {
                        renderTaskRef.current.cancel();
                    } catch {}
                }

                const page = await pdfDoc.getPage(pageNum);
                if (isCancelled) return;

                const viewport = page.getViewport({ scale });
                const canvas = canvasRef.current;
                if (!canvas) return;

                const outputScale = window.devicePixelRatio || 1;
                canvas.width = Math.floor(viewport.width * outputScale);
                canvas.height = Math.floor(viewport.height * outputScale);
                canvas.style.width = `${Math.floor(viewport.width)}px`;
                canvas.style.height = `${Math.floor(viewport.height)}px`;

                const ctx = canvas.getContext("2d");
                if (!ctx) return;

                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = "high";

                const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

                const renderContext = {
                    canvasContext: ctx,
                    viewport: viewport,
                    transform: transform || undefined
                };

                const renderTask = page.render(renderContext);
                renderTaskRef.current = renderTask;
                await renderTask.promise;
            } catch (err: any) {
                if (err?.name !== "RenderingCancelledException") {
                    console.error(`Error renderizando página ${pageNum}:`, err);
                }
            }
        }

        renderPage();

        return () => {
            isCancelled = true;
            if (renderTaskRef.current) {
                try { renderTaskRef.current.cancel(); } catch {}
            }
        };
    }, [pdfDoc, pageNum, scale]);

    const width = Math.floor((pageData?.originalWidth || 595) * scale);
    const height = Math.floor((pageData?.originalHeight || 842) * scale);

    return (
        <div
            id={`pdf-page-${pageNum}`}
            className="relative bg-white shadow-2xl rounded-sm border border-slate-700/50 shrink-0"
            style={{ width, height }}
        >
            {/* Número de página flotante */}
            <div className="absolute -top-3.5 right-2 bg-slate-800 text-slate-300 text-[10px] font-mono px-2 py-0.5 rounded shadow border border-slate-700 select-none z-10">
                Pág. {pageNum}
            </div>

            {/* Canvas de renderizado de alta fidelidad */}
            <canvas ref={canvasRef} className="block w-full h-full" />
        </div>
    );
});
PdfPageItem.displayName = "PdfPageItem";

export const PdfCanvasViewer: React.FC<PdfCanvasViewerProps> = ({
    pdfUrl,
    cardTitle,
    cardContent,
    cardIndex,
    enableHighlight = false,
    onToggleHighlight,
    onTextFound,
    className = ""
}) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const pagesContainerRef = useRef<HTMLDivElement | null>(null);
    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [numPages, setNumPages] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [scale, setScale] = useState<number>(1.25);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [manualSearch, setManualSearch] = useState<string>("");
    const [showSearchInput, setShowSearchInput] = useState<boolean>(false);
    const [pageDataList, setPageDataList] = useState<PageData[]>([]);
    const [globalHighlight, setGlobalHighlight] = useState<GlobalHighlight | null>(null);

    // Cargar documento PDF
    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        setError(null);
        setPageDataList([]);
        setGlobalHighlight(null);

        async function loadPdf() {
            try {
                const loadingTask = pdfjsLib.getDocument({
                    url: pdfUrl,
                    cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/",
                    cMapPacked: true,
                    standardFontDataUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/standard_fonts/"
                });

                const doc = await loadingTask.promise;
                if (!isMounted) return;

                setPdfDoc(doc);
                setNumPages(doc.numPages);

                // Extraer texto y geometrías de todas las páginas para sincronización precisa
                const pagesData: PageData[] = [];
                for (let p = 1; p <= doc.numPages; p++) {
                    const page = await doc.getPage(p);
                    const viewport = page.getViewport({ scale: 1.0 });
                    const textContent = await page.getTextContent();
                    
                    const items: PageTextItem[] = [];
                    let fullText = "";

                    for (const item of textContent.items as any[]) {
                        if (!item.str || typeof item.str !== "string") continue;
                        const tx = item.transform[4] || 0;
                        const ty = item.transform[5] || 0;
                        const itemW = item.width || 0;
                        const itemH = item.height || Math.abs(item.transform[0]) || 12;
                        const pageH = viewport.height;

                        const x = tx;
                        const y = Math.max(0, pageH - ty - itemH);

                        const startChar = fullText.length;
                        fullText += (fullText.length > 0 ? " " : "") + item.str;
                        const endChar = fullText.length;

                        items.push({
                            str: item.str,
                            x,
                            y,
                            width: itemW,
                            height: itemH,
                            startChar,
                            endChar
                        });
                    }

                    pagesData.push({
                        pageNumber: p,
                        items,
                        fullText,
                        originalWidth: viewport.width,
                        originalHeight: viewport.height
                    });
                }

                if (isMounted) {
                    setPageDataList(pagesData);
                    setLoading(false);
                }
            } catch (err: any) {
                console.error("Error al cargar PDF:", err);
                if (isMounted) {
                    setError(err.message || "Error al abrir el documento");
                    setLoading(false);
                }
            }
        }

        if (pdfUrl) {
            loadPdf();
        }

        return () => {
            isMounted = false;
        };
    }, [pdfUrl]);

    // Recalcular posición del Highlight flotante continuo al cambiar escala o scroll
    const recalculatePositions = useCallback((hlData: Omit<GlobalHighlight, 'top' | 'left' | 'width' | 'height'>): GlobalHighlight | null => {
        const startPageElem = document.getElementById(`pdf-page-${hlData.startPage}`);
        const endPageElem = document.getElementById(`pdf-page-${hlData.endPage}`);
        if (!startPageElem || !endPageElem) return null;

        const startOffsetTop = startPageElem.offsetTop;
        const endOffsetTop = endPageElem.offsetTop;
        const startOffsetLeft = startPageElem.offsetLeft;

        const paddingX = 10;
        const paddingY = 8;

        const startLocalY = Math.max(0, (hlData.startUnscaledY - paddingY) * scale);
        const endLocalBottom = (hlData.endUnscaledBottom + paddingY) * scale;

        const globalTop = startOffsetTop + startLocalY;
        const globalBottom = endOffsetTop + endLocalBottom;
        const globalHeight = Math.max(30, globalBottom - globalTop);

        const boxLeft = Math.max(0, (hlData.minX - paddingX) * scale);
        const boxWidth = Math.min((hlData.pageWidth * scale) - boxLeft, (hlData.maxX - hlData.minX + (paddingX * 2)) * scale);

        return {
            ...hlData,
            top: globalTop,
            left: startOffsetLeft + boxLeft,
            width: boxWidth,
            height: globalHeight
        };
    }, [scale]);

    // Sincronización continua de la tarjeta activa con el PDF (incluso a través de múltiples páginas)
    const updateHighlight = useCallback(() => {
        if (!enableHighlight || !pageDataList.length || (!cardTitle && !cardContent && !manualSearch)) {
            setGlobalHighlight(null);
            return;
        }

        const cleanManual = normalizeSearchText(manualSearch);
        const { normTitle, normTitleWithoutNum } = getCleanTitle(cardTitle);
        const normTitleWords = normTitle.split(' ').filter((w: string) => w.length >= 3);

        const isCurrentCardAnIndex = isIndexTitle(cardTitle) || (cardIndex === 0 && (
            normTitle.includes('indice') || 
            normTitle.includes('contidos') || 
            normTitle.includes('contenidos') || 
            (cardContent && (cardContent.includes('....') || cardContent.includes('...')))
        ));

        const cleanContent = (cardContent || "").replace(/<[^>]*>/g, " ");
        const normContent = normalizeSearchText(cleanContent);
        const contentWords = normContent.split(' ').filter(w => w.length >= 3);
        const contentWordsSet = new Set(contentWords);

        // N-grams de 4 y 3 palabras del inicio del contenido
        const start4Grams: string[] = [];
        for (let i = 0; i < Math.min(20, contentWords.length - 3); i++) {
            start4Grams.push(contentWords.slice(i, i + 4).join(' '));
        }

        // Frases clave de inicio (3-grams de las primeras 25 palabras)
        const startPhrases: string[] = [];
        for (let i = 0; i < Math.min(25, contentWords.length - 2); i++) {
            startPhrases.push(contentWords.slice(i, i + 3).join(' '));
        }

        // Frases clave de final
        const endPhrases: string[] = [];
        const endStartIdx = Math.max(0, contentWords.length - 25);
        for (let i = endStartIdx; i < contentWords.length - 2; i++) {
            endPhrases.push(contentWords.slice(i, i + 3).join(' '));
        }
        for (let i = Math.max(0, contentWords.length - 10); i < contentWords.length - 1; i++) {
            endPhrases.push(contentWords.slice(i, i + 2).join(' '));
        }

        // 1. ENCONTRAR LA PÁGINA DE INICIO (startPageNumber): descartando Índice y buscando coincidencia real
        let startPageNumber = -1;

        if (cleanManual && cleanManual.length >= 2) {
            for (const pageData of pageDataList) {
                const normPageText = normalizeSearchText(pageData.fullText);
                if (normPageText.includes(cleanManual)) {
                    startPageNumber = pageData.pageNumber;
                    break;
                }
            }
        } else {
            // Reutilizar start4Grams ya inicializados

            let maxScore = -1;

            for (const pageData of pageDataList) {
                const isToc = isTocPage(pageData);

                // Si la tarjeta ES el índice, nos enfocamos en páginas de índice (primeras 5 páginas)
                if (isCurrentCardAnIndex) {
                    if (!isToc && pageData.pageNumber > 3) continue;
                } else {
                    // Si es una tarjeta de contenido normal, descartamos páginas de índice
                    if (isToc) continue;
                }

                const normPageText = normalizeSearchText(pageData.fullText);
                let score = 0;

                // Coincidencia exacta de título completo con número (ej: "3.1 Clasificación", "1.1 Nutrición...")
                if (normTitle.length >= 5 && normPageText.includes(normTitle)) {
                    score += 600;
                }

                // Coincidencia de frases de 4 palabras del inicio
                for (const g4 of start4Grams) {
                    if (normPageText.includes(g4)) {
                        score += 350;
                    }
                }

                // Coincidencia de frases de 3 palabras del inicio
                for (const sp of startPhrases) {
                    if (normPageText.includes(sp)) {
                        score += 150;
                    }
                }

                // Si tiene título pero sin número (ej: solo "clasificación"), requiere además coincidencia de contenido
                if (normTitleWithoutNum.length >= 5 && normPageText.includes(normTitleWithoutNum)) {
                    const hasSomeContent = startPhrases.some(sp => normPageText.includes(sp)) || start4Grams.some(g4 => normPageText.includes(g4));
                    if (hasSomeContent) {
                        score += 200;
                    }
                }

                // Densidad general de palabras del tema
                const pageWords = normPageText.split(' ').filter(w => w.length >= 3);
                const wordMatches = pageWords.filter(w => contentWordsSet.has(w)).length;
                score += wordMatches;

                if (score > maxScore) {
                    maxScore = score;
                    startPageNumber = pageData.pageNumber;
                }
            }
        }

        if (startPageNumber === -1) startPageNumber = 1;

        const startPageData = pageDataList.find(p => p.pageNumber === startPageNumber);
        if (!startPageData || startPageData.items.length === 0) return;

        // 2. ENCONTRAR firstMatchedIdx en startPageData usando anclaje de contenido (Sliding Window) + verificación de viñeta/encabezado
        let firstMatchedIdx = -1;

        if (cleanManual) {
            for (let i = 0; i < startPageData.items.length; i++) {
                const normItem = normalizeSearchText(startPageData.items[i].str);
                if (normItem.includes(cleanManual)) {
                    firstMatchedIdx = i;
                    break;
                }
            }
        } else {
            let contentStartIdx = -1;

            // Ventana deslizante de hasta 4 elementos consecutivos para encontrar el inicio exacto del contenido
            for (let i = 0; i < startPageData.items.length; i++) {
                if (isIgnoredPageFooterOrArtifact(startPageData.items[i], startPageData.originalHeight)) continue;
                const windowStr = [
                    startPageData.items[i]?.str || "",
                    startPageData.items[i + 1]?.str || "",
                    startPageData.items[i + 2]?.str || "",
                    startPageData.items[i + 3]?.str || ""
                ].join(" ");
                const normWindow = normalizeSearchText(windowStr);
                if (start4Grams.some(g4 => normWindow.includes(g4)) || startPhrases.some(sp => normWindow.includes(sp))) {
                    contentStartIdx = i;
                    break;
                }
            }

            if (contentStartIdx !== -1) {
                firstMatchedIdx = contentStartIdx;
                let foundBulletIdx = -1;
                let foundTitleIdx = -1;

                // Buscar hacia atrás hasta 8 elementos para incluir la viñeta ("-", "•") o encabezado propio
                for (let back = 1; back <= 8; back++) {
                    const prevIdx = contentStartIdx - back;
                    if (prevIdx < 0) break;
                    const prevItem = startPageData.items[prevIdx];
                    if (isIgnoredPageFooterOrArtifact(prevItem, startPageData.originalHeight)) continue;
                    const prevStr = prevItem.str.trim();
                    const prevNorm = normalizeSearchText(prevStr);
                    if (!prevStr) continue;

                    // Si encontramos una viñeta ("-", "−", "•", "*")
                    if (/^[-−•*#]/.test(prevStr)) {
                        foundBulletIdx = prevIdx;
                        break; // La viñeta es el inicio absoluto del sub-ítem
                    }

                    // Si encontramos un encabezado numerado o título de unidad
                    if (/^\d+(\.\d+)*\./.test(prevStr) || /^(?:UNIDADE|UNIDAD|TEMA|UD)\b/i.test(prevStr)) {
                        foundTitleIdx = prevIdx;
                        // Si hay un "UNIDADE X" inmediatamente arriba, incluirlo
                        if (prevIdx > 0) {
                            const aboveStr = startPageData.items[prevIdx - 1]?.str?.trim() || "";
                            if (/^(?:UNIDADE|UNIDAD)\b/i.test(aboveStr)) {
                                foundTitleIdx = prevIdx - 1;
                            }
                        }
                        break;
                    }

                    if (normTitleWords.length > 0 && normTitleWords.some((tw: string) => prevNorm.includes(tw))) {
                        if (foundTitleIdx === -1) foundTitleIdx = prevIdx;
                    }

                    // Detenerse si topamos con un punto final de un párrafo anterior no relacionado
                    if (back > 3 && prevStr.endsWith(".") && !normTitleWords.some((tw: string) => prevNorm.includes(tw))) {
                        break;
                    }
                }

                if (foundBulletIdx !== -1) {
                    firstMatchedIdx = foundBulletIdx;
                } else if (foundTitleIdx !== -1) {
                    firstMatchedIdx = foundTitleIdx;
                }
            }

            // Fallback por coincidencia de título si el contenido no pudo ser anclado
            if (firstMatchedIdx === -1) {
                for (let i = 0; i < startPageData.items.length; i++) {
                    const item = startPageData.items[i];
                    if (isIgnoredPageFooterOrArtifact(item, startPageData.originalHeight)) continue;
                    const normItem = normalizeSearchText(item.str);
                    if (normItem.length >= 5 && normTitle.length >= 5 && (normTitle === normItem || normItem.includes(normTitle))) {
                        firstMatchedIdx = i;
                        break;
                    }
                }
            }
        }

        if (firstMatchedIdx === -1) firstMatchedIdx = 0;

        // 3. DETERMINAR endPageNumber y endMatchedIdx CON LÍMITE ESTRICTO DE 1 A 2 PÁGINAS MÁXIMO
        let endPageNumber = startPageNumber;
        let endMatchedIdx = -1;

        // Buscar frases finales en startPageData usando ventana deslizante hacia atrás
        for (let i = startPageData.items.length - 1; i >= firstMatchedIdx; i--) {
            const item = startPageData.items[i];
            if (isIgnoredPageFooterOrArtifact(item, startPageData.originalHeight)) continue;
            const windowStr = [
                startPageData.items[Math.max(0, i - 2)]?.str || "",
                startPageData.items[Math.max(0, i - 1)]?.str || "",
                item.str || ""
            ].join(" ");
            const normWindow = normalizeSearchText(windowStr);
            if (endPhrases.some(ep => normWindow.includes(ep))) {
                endMatchedIdx = i;
                break;
            }
        }

        if (endMatchedIdx !== -1) {
            endPageNumber = startPageNumber;
        } else {
            // Comprobar la página siguiente
            const nextPageData = pageDataList.find(p => p.pageNumber === startPageNumber + 1);
            if (nextPageData && nextPageData.items.length > 0) {
                for (let i = 0; i < nextPageData.items.length; i++) {
                    const item = nextPageData.items[i];
                    if (isIgnoredPageFooterOrArtifact(item, nextPageData.originalHeight)) continue;
                    const windowStr = [
                        nextPageData.items[Math.max(0, i - 2)]?.str || "",
                        nextPageData.items[Math.max(0, i - 1)]?.str || "",
                        item.str || ""
                    ].join(" ");
                    const normWindow = normalizeSearchText(windowStr);
                    if (endPhrases.some(ep => normWindow.includes(ep))) {
                        endMatchedIdx = i;
                        endPageNumber = startPageNumber + 1;
                        break;
                    }
                }
            }

            if (endMatchedIdx === -1) {
                endPageNumber = startPageNumber;
                for (let i = startPageData.items.length - 1; i >= firstMatchedIdx; i--) {
                    if (!isIgnoredPageFooterOrArtifact(startPageData.items[i], startPageData.originalHeight)) {
                        endMatchedIdx = i;
                        break;
                    }
                }
                if (endMatchedIdx === -1) endMatchedIdx = startPageData.items.length - 1;
            }
        }

        // Si endMatchedIdx cae sobre el guion o inicio de la siguiente viñeta, retroceder 1 elemento
        const finalEndPage = pageDataList.find(p => p.pageNumber === endPageNumber) || startPageData;
        const endStr = finalEndPage.items[endMatchedIdx]?.str?.trim() || "";
        if (/^[-−•*]/.test(endStr) && endMatchedIdx > (endPageNumber === startPageNumber ? firstMatchedIdx : 0)) {
            endMatchedIdx--;
        }

        // 4. EXTRAER COORDENADAS GLOBALES DEL BLOQUE
        const startPageItems = startPageData.items
            .slice(firstMatchedIdx, endPageNumber === startPageNumber ? endMatchedIdx + 1 : undefined)
            .filter(i => !isIgnoredPageFooterOrArtifact(i, startPageData.originalHeight));

        const endPageData = pageDataList.find(p => p.pageNumber === endPageNumber) || startPageData;
        const nextPageItems = endPageNumber > startPageNumber
            ? endPageData.items
                .slice(0, endMatchedIdx + 1)
                .filter(i => !isIgnoredPageFooterOrArtifact(i, endPageData.originalHeight))
            : [];

        const allMatchedItems = [...startPageItems, ...nextPageItems];

        // startUnscaledY: punto más alto (mínimo Y) de los elementos de la tarjeta en la página inicial
        const startUnscaledY = startPageItems.length > 0
            ? Math.min(...startPageItems.map(i => i.y))
            : (startPageData.items[firstMatchedIdx]?.y || 40);

        // endUnscaledBottom: punto más bajo (máximo Y + height) del bloque en la página de cierre
        const targetEndItems = endPageNumber === startPageNumber ? startPageItems : (nextPageItems.length > 0 ? nextPageItems : startPageItems);
        const endUnscaledBottom = targetEndItems.length > 0
            ? Math.max(...targetEndItems.map(i => i.y + i.height))
            : (endPageData.items[endMatchedIdx]?.y || 0) + (endPageData.items[endMatchedIdx]?.height || 20);

        const minX = allMatchedItems.length > 0 ? Math.min(...allMatchedItems.map(i => i.x)) : 40;
        const maxX = allMatchedItems.length > 0 ? Math.max(...allMatchedItems.map(i => i.x + i.width)) : startPageData.originalWidth - 40;
        const pageWidth = startPageData.originalWidth;

        const rawHighlightData = {
            startPage: startPageNumber,
            endPage: endPageNumber,
            startUnscaledY,
            endUnscaledBottom,
            minX,
            maxX,
            pageWidth
        };

        const calculated = recalculatePositions(rawHighlightData);
        if (calculated) {
            setGlobalHighlight(calculated);
            setCurrentPage(startPageNumber);
            if (onTextFound) onTextFound(startPageNumber);

            // Auto-scroll suave viajando al bloque señalado
            setTimeout(() => {
                const container = containerRef.current;
                if (container) {
                    const containerHeight = container.clientHeight || 600;
                    const targetScrollTop = calculated.top - (containerHeight / 3);
                    container.scrollTo({
                        top: Math.max(0, targetScrollTop),
                        behavior: 'smooth'
                    });
                }
            }, 80);
        }
    }, [enableHighlight, pageDataList, cardTitle, cardContent, cardIndex, manualSearch, scale, onTextFound, recalculatePositions]);

    useEffect(() => {
        const timer = setTimeout(() => {
            updateHighlight();
        }, 120);
        return () => clearTimeout(timer);
    }, [updateHighlight]);

    // Recalcular el highlight global cuando cambia el tamaño de escala
    useEffect(() => {
        if (globalHighlight) {
            const updated = recalculatePositions(globalHighlight);
            if (updated) setGlobalHighlight(updated);
        }
    }, [scale, recalculatePositions]);

    // Función para re-centrar el visor en el bloque verde de la tarjeta activa
    const handleCenterOnHighlight = () => {
        if (globalHighlight && containerRef.current) {
            const containerHeight = containerRef.current.clientHeight || 600;
            const targetScrollTop = globalHighlight.top - (containerHeight / 3);
            containerRef.current.scrollTo({
                top: Math.max(0, targetScrollTop),
                behavior: "smooth"
            });
        }
    };

    const handleZoomIn = () => setScale(s => Math.min(s + 0.2, 2.5));
    const handleZoomOut = () => setScale(s => Math.max(s - 0.2, 0.6));
    const handleFitWidth = () => {
        if (containerRef.current && pageDataList[0]) {
            const availableWidth = containerRef.current.clientWidth - 48;
            const newScale = availableWidth / pageDataList[0].originalWidth;
            setScale(Math.max(0.6, Math.min(newScale, 2.0)));
        }
    };

    return (
        <div className={`flex flex-col h-full w-full bg-slate-900 text-slate-100 overflow-hidden relative select-none ${className}`}>
            {/* Barra de Herramientas del Visor */}
            <div className="flex items-center justify-between px-3 py-2 bg-slate-950/90 border-b border-slate-800 text-xs shrink-0 z-30 flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                    {onToggleHighlight && (
                        <button
                            onClick={() => onToggleHighlight(!enableHighlight)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all ${
                                enableHighlight 
                                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 shadow-sm" 
                                    : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                            }`}
                            title={enableHighlight ? "Desactivar resaltador sincronizado" : "Activar resaltador sincronizado"}
                        >
                            <div className={`w-2 h-2 rounded-full ${enableHighlight ? "bg-emerald-400 shadow-[0_0_6px_#10b981]" : "bg-slate-500"}`} />
                            <span>{enableHighlight ? "Sincronizado: ON" : "Sincronizado: OFF"}</span>
                        </button>
                    )}
                    {globalHighlight && enableHighlight && (
                        <button
                            onClick={handleCenterOnHighlight}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black shadow-md shadow-emerald-500/20 transition-all transform active:scale-95 animate-pulse"
                            title="Desplazarse directamente al bloque verde de la tarjeta"
                        >
                            <Focus size={14} className="stroke-[2.5]" />
                            <span className="text-[11px] uppercase tracking-wider">
                                {globalHighlight.startPage === globalHighlight.endPage 
                                    ? `Pág. ${globalHighlight.startPage}` 
                                    : `Págs. ${globalHighlight.startPage} - ${globalHighlight.endPage}`}
                            </span>
                        </button>
                    )}
                </div>

                {/* Búsqueda manual dentro del documento */}
                <div className="flex items-center gap-1">
                    {showSearchInput ? (
                        <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-xl px-2 py-1">
                            <input
                                type="text"
                                value={manualSearch}
                                onChange={(e) => setManualSearch(e.target.value)}
                                placeholder="Buscar en PDF..."
                                className="bg-transparent text-xs text-white placeholder-slate-500 outline-none w-28 sm:w-36"
                                autoFocus
                            />
                            {manualSearch && (
                                <button onClick={() => setManualSearch("")} className="text-slate-400 hover:text-white text-xs">×</button>
                            )}
                            <button onClick={() => setShowSearchInput(false)} className="text-slate-400 hover:text-white">
                                <Search size={12} />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setShowSearchInput(true)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            title="Buscar texto en el documento"
                        >
                            <Search size={15} />
                        </button>
                    )}

                    {/* Controles de Zoom */}
                    <div className="flex items-center gap-0.5 bg-slate-900 p-0.5 rounded-xl border border-slate-800">
                        <button
                            onClick={handleZoomOut}
                            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40"
                            title="Alejar (-)"
                        >
                            <ZoomOut size={15} />
                        </button>
                        <span className="text-[11px] font-mono font-bold px-1 text-slate-300 min-w-[38px] text-center">
                            {Math.round(scale * 100)}%
                        </span>
                        <button
                            onClick={handleZoomIn}
                            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40"
                            title="Acercar (+)"
                        >
                            <ZoomIn size={15} />
                        </button>
                        <button
                            onClick={handleFitWidth}
                            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-[10px] font-bold px-1.5"
                            title="Ajustar al ancho"
                        >
                            Ajustar
                        </button>
                    </div>
                </div>
            </div>

            {/* Contenedor Principal de Páginas con Scroll Continuo */}
            <div
                ref={containerRef}
                className="flex-1 w-full h-full overflow-y-auto overflow-x-auto p-4 flex flex-col items-center gap-6 bg-slate-900 custom-scrollbar relative"
            >
                {loading && (
                    <div className="absolute inset-0 z-40 bg-slate-900/90 flex flex-col items-center justify-center gap-3 backdrop-blur-xs">
                        <Loader2 size={32} className="text-emerald-400 animate-spin" />
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                            Cargando documento PDF de alta fidelidad...
                        </span>
                    </div>
                )}

                {error && (
                    <div className="m-auto p-6 max-w-md bg-rose-950/40 border border-rose-800 rounded-2xl flex flex-col items-center text-center gap-3">
                        <AlertCircle size={32} className="text-rose-400" />
                        <h4 className="text-sm font-bold text-rose-200">Error al visualizar PDF</h4>
                        <p className="text-xs text-rose-300/80">{error}</p>
                        <a
                            href={pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md"
                        >
                            Abrir PDF en pestaña nueva
                        </a>
                    </div>
                )}

                {/* Renderizado de Páginas con Capa Global de Resaltado Continuo */}
                {!loading && !error && (
                    <div ref={pagesContainerRef} className="flex flex-col items-center gap-6 pb-20 relative">
                        {Array.from({ length: numPages }, (_, idx) => {
                            const pageNum = idx + 1;
                            return (
                                <PdfPageItem
                                    key={pageNum}
                                    pageNum={pageNum}
                                    pdfDoc={pdfDoc}
                                    scale={scale}
                                    pageData={pageDataList[idx]}
                                />
                            );
                        })}

                        {/* CAPA GLOBAL POR ENCIMA DEL PDF: PUEDE PASAR POR ENCIMA DE LAS ESTRUCTURAS DE LAS HOJAS */}
                        {globalHighlight && (
                            <div
                                className="absolute pointer-events-none transition-all duration-300 z-30"
                                style={{
                                    left: `${globalHighlight.left}px`,
                                    top: `${globalHighlight.top}px`,
                                    width: `${globalHighlight.width}px`,
                                    height: `${globalHighlight.height}px`,
                                    border: "3px solid #10b981", // Borde verde de 3px
                                    backgroundColor: "rgba(16, 185, 129, 0.12)",
                                    borderRadius: "8px",
                                    boxShadow: "0 0 0 2px rgba(16, 185, 129, 0.35), 0 8px 32px rgba(16, 185, 129, 0.25)"
                                }}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
