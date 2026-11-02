import re
import httpx
import pymupdf
import pymupdf4llm
from typing import List, Dict, Any, Optional

def clean_card_title(raw: str, default_title: str) -> str:
    cleaned = re.sub(r"^[-*#\s_]+", "", raw)
    cleaned = re.sub(r"[-*#\s_]+$", "", cleaned).strip()
    return cleaned if cleaned else default_title

async def process_pdf_from_url(pdf_url: str) -> List[Dict[str, Any]]:
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.get(pdf_url)
        if res.status_code != 200:
            raise ValueError(f"No se pudo descargar el PDF de Storage: HTTP {res.status_code}")
        pdf_bytes = res.content

    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    pages_data = pymupdf4llm.to_markdown(doc, page_chunks=True)

    cards: List[Dict[str, Any]] = []
    card_index = 0
    heading_pattern = re.compile(r"(?=(?:^|\n)#{1,3}\s+)")

    for page_item in pages_data:
        page_num = page_item.get("metadata", {}).get("page", 1)
        text = page_item.get("text", "").strip()
        if not text:
            continue

        sections = heading_pattern.split(text)
        for sec in sections:
            sec_clean = sec.strip()
            if not sec_clean:
                continue

            lines = sec_clean.split("\n")
            first_line = lines[0] if lines else ""
            if first_line.startswith("#"):
                title = clean_card_title(first_line, f"Página {page_num} - Sección {card_index + 1}")
                body = "\n".join(lines[1:]).strip()
            else:
                title = f"Página {page_num} - Tema {card_index + 1}"
                body = sec_clean

            if len(body) > 30 or len(sec_clean) > 50:
                cards.append({
                    "titulo": title[:100],
                    "contenido": body if body else sec_clean,
                    "orden": card_index,
                    "pagina": page_num
                })
                card_index += 1

    return cards
