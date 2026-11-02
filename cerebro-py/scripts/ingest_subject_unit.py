"""
Script de Ingesta, Transformación y Generación de Datasets Reales por Unidad Didáctica.
LMS Alquimia - Preparación de Datos para ML & RAG.
"""

import os
import sys
import json
import httpx
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(".env.local")

from services.pdf_extractor import extract_pdf_to_clean_records
from services.translator import normalize_records_to_spanish
from services.chunker import create_hierarchical_chunks
from services.qa_generator import generate_instruction_pairs
from services.hash_manager import compute_content_hash, compute_embed_hash

# Catálogo completo oficial de las 11 Unidades Didácticas de Alimentación Equilibrada
SUBJECT_CATALOG = {
    "UD1": {
        "nombre": "UD1.Conceptos basicos",
        "url": "https://ybqzcxabblyzqhezanaf.supabase.co/storage/v1/object/public/cerebro-nutricionista/dietetica-nutricion/alimentacion-equilibrada/UD1.Conceptos%20basicos",
        "archivo": "UD1.Conceptos basicos.pdf",
        "orden": 0
    },
    "UD2": {
        "nombre": "UD2.MACRONUTRIENTES E METABOLISMO ENERXETICO",
        "url": "https://ybqzcxabblyzqhezanaf.supabase.co/storage/v1/object/public/cerebro-nutricionista/dietetica-nutricion/alimentacion-equilibrada/UD2.MACRONUTRIENTES%20E%20METABOLISMO%20ENERXETICO.pdf",
        "archivo": "UD2.MACRONUTRIENTES E METABOLISMO ENERXETICO.pdf",
        "orden": 1
    },
    "UD3": {
        "nombre": "UD3. Micronutrientes e auga",
        "url": "https://ybqzcxabblyzqhezanaf.supabase.co/storage/v1/object/public/cerebro-nutricionista/dietetica-nutricion/alimentacion-equilibrada/UD3.%20Micronutrientes%20e%20auga_.pdf",
        "archivo": "UD3. Micronutrientes e auga.pdf",
        "orden": 2
    },
    "UD4": {
        "nombre": "UD4. OS ALIMENTOS",
        "url": "https://ybqzcxabblyzqhezanaf.supabase.co/storage/v1/object/public/cerebro-nutricionista/dietetica-nutricion/alimentacion-equilibrada/UD4.%20OS%20ALIMENTOS.PDF.pdf",
        "archivo": "UD4. OS ALIMENTOS.pdf",
        "orden": 3
    },
    "UD5": {
        "nombre": "UD5. ENERXIA E REQUISITOS ENERXETICOS",
        "url": "https://ybqzcxabblyzqhezanaf.supabase.co/storage/v1/object/public/cerebro-nutricionista/dietetica-nutricion/alimentacion-equilibrada/UD5.%20ENERXIA%20E%20REQUISITOS%20ENERXETICOS.pdf",
        "archivo": "UD5. ENERXIA E REQUISITOS ENERXETICOS.pdf",
        "orden": 4
    },
    "UD6": {
        "nombre": "UD6. HIST.CLINICA, ANAMNESE E AVAL.CLINICA",
        "url": "https://ybqzcxabblyzqhezanaf.supabase.co/storage/v1/object/public/cerebro-nutricionista/dietetica-nutricion/alimentacion-equilibrada/UD6.%20HISTORIA%20CLINICA,%20ANAMNESE%20E%20AVALIACION%20CLINICA.pdf",
        "archivo": "UD6. HIST.CLINICA, ANAMNESE E AVAL.CLINICA.pdf",
        "orden": 5
    },
    "UD7": {
        "nombre": "UD7.VALORACION BIOQUIMICA",
        "url": "https://ybqzcxabblyzqhezanaf.supabase.co/storage/v1/object/public/cerebro-nutricionista/dietetica-nutricion/alimentacion-equilibrada/UD7.VALORACION%20BIOQUIMICA.pdf",
        "archivo": "UD7.VALORACION BIOQUIMICA.pdf",
        "orden": 6
    },
    "UD8": {
        "nombre": "UD8. Valoracion nutricional",
        "url": "https://ybqzcxabblyzqhezanaf.supabase.co/storage/v1/object/public/cerebro-nutricionista/dietetica-nutricion/alimentacion-equilibrada/UD8.%20Valoracion%20nutricional.pdf",
        "archivo": "UD8. Valoracion nutricional.pdf",
        "orden": 7
    },
    "UD9": {
        "nombre": "UD9.VALORACION DA INXESTION DIETETICA",
        "url": "https://ybqzcxabblyzqhezanaf.supabase.co/storage/v1/object/public/cerebro-nutricionista/dietetica-nutricion/alimentacion-equilibrada/UD9.VALORACION%20DA%20INXESTION%20DIETETICA.pdf",
        "archivo": "UD9.VALORACION DA INXESTION DIETETICA.pdf",
        "orden": 8
    },
    "UD10": {
        "nombre": "UD10.Aliment. equilibrada para persoas sas",
        "url": "https://ybqzcxabblyzqhezanaf.supabase.co/storage/v1/object/public/cerebro-nutricionista/dietetica-nutricion/alimentacion-equilibrada/UD10.Alimentacion%20equilibrada%20para%20persoas%20sas",
        "archivo": "UD10.Aliment. equilibrada para persoas sas.pdf",
        "orden": 9
    },
    "UD11": {
        "nombre": "UD11.ALIMENTACION NAS DIFERENTES ETAPAS DA VIDA",
        "url": "https://ybqzcxabblyzqhezanaf.supabase.co/storage/v1/object/public/cerebro-nutricionista/dietetica-nutricion/alimentacion-equilibrada/UD11.ALIMENTACION%20E%20NUTRICION%20NAS%20DIFERENTES%20ETAPAS%20DA%20VIDA.pdf",
        "archivo": "UD11.ALIMENTACION NAS DIFERENTES ETAPAS DA VIDA.pdf",
        "orden": 10
    }
}


def ingest_unit(unit_key: str = "UD1", asignatura: str = "alimentacion-equilibrada") -> dict:
    unit_info = SUBJECT_CATALOG.get(unit_key)
    if not unit_info:
        print(f"❌ Error: Unidad '{unit_key}' no encontrada en el catálogo.")
        return {}

    print(f"\n=======================================================")
    print(f"🚀 INGESTANDO DATOS REALES: {unit_key} - {unit_info['nombre']}")
    print(f"=======================================================")

    # 1. Descargar PDF real desde Supabase Storage
    print(f"📥 1. Descargando PDF desde Supabase Storage...")
    resp = httpx.get(unit_info["url"], timeout=60.0)
    resp.raise_for_status()
    pdf_bytes = resp.content
    print(f"   ✓ Descargado con éxito: {len(pdf_bytes):,} bytes")

    # 2. Extracción BBox y De-hyphenation
    print(f"✂️  2. Extrayendo texto limpio (BBox Crop 8% y filtro de preliminares)...")
    raw_records = extract_pdf_to_clean_records(
        pdf_source=pdf_bytes,
        asignatura=asignatura,
        doc_name=unit_info["archivo"]
    )
    print(f"   ✓ Páginas pedagógicas extraídas: {len(raw_records)}")

    # 3. Normalización Lingüística (Gallego -> Castellano)
    print(f"🌐 3. Normalizando glosario clínico (Gallego ➔ Castellano con motor neural)...")
    es_records = normalize_records_to_spanish(raw_records)
    print(f"   ✓ Registros traducidos y re-hasheados: {len(es_records)}")

    # 4. Chunking Jerárquico (Padre / Hijo)
    print(f"🧩 4. Generando troceado semántico jerárquico Padre/Hijo...")
    parents, children = create_hierarchical_chunks(es_records)
    print(f"   ✓ Macro-chunks Padres: {len(parents)}")
    print(f"   ✓ Micro-chunks Hijos (con linaje de contexto inyectado): {len(children)}")

    # 5. Generación de Pares QA ChatML Supervisados
    print(f"💎 5. Sintetizando pares de instrucción ChatML con Profesor Alquimia...")
    chatml_pairs = generate_instruction_pairs(children)
    print(f"   ✓ Pares formativos ChatML validados por guardrails: {len(chatml_pairs)}")

    # 6. Guardar Datasets Inmutables en Disco
    output_dir = Path("data/datasets") / asignatura / unit_key
    output_dir.mkdir(parents=True, exist_ok=True)

    # 6.1 raw_extracted.jsonl
    raw_path = output_dir / "raw_extracted.jsonl"
    with open(raw_path, "w", encoding="utf-8") as f:
        for r in raw_records:
            f.write(r.model_dump_json() + "\n")

    # 6.2 normalized_es.jsonl
    es_path = output_dir / "normalized_es.jsonl"
    with open(es_path, "w", encoding="utf-8") as f:
        for r in es_records:
            f.write(r.model_dump_json() + "\n")

    # 6.3 rag_embeddings.jsonl (Hijos)
    rag_path = output_dir / "rag_embeddings.jsonl"
    with open(rag_path, "w", encoding="utf-8") as f:
        for c in children:
            c_hash = compute_content_hash(c.contenido_markdown)
            e_hash = compute_embed_hash(c_hash)
            row = {
                "id": c.id,
                "parent_id": c.parent_id,
                "asignatura": c.asignatura,
                "seccion": c.seccion,
                "pagina_inicio": c.pagina_inicio,
                "pagina_fin": c.pagina_fin,
                "content_hash": c_hash,
                "embed_hash": e_hash,
                "text_for_embedding": c.contenido_markdown,
                "metadata": c.metadata.model_dump()
            }
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    # 6.4 sft_chatml.jsonl
    sft_path = output_dir / "sft_chatml.jsonl"
    with open(sft_path, "w", encoding="utf-8") as f:
        for item in chatml_pairs:
            f.write(json.dumps(item, ensure_ascii=False) + "\n")

    # 6.5 Manifest de release
    total_words = sum(c.metadata.num_palabras for c in children)
    manifest = {
        "unit": unit_key,
        "asignatura": asignatura,
        "nombre_oficial": unit_info["nombre"],
        "paginas_pedagogicas": len(raw_records),
        "macro_chunks_padres": len(parents),
        "micro_chunks_hijos": len(children),
        "chatml_ejemplos_sft": len(chatml_pairs),
        "total_palabras_hijos": total_words,
        "archivos_generados": [
            str(raw_path),
            str(es_path),
            str(rag_path),
            str(sft_path)
        ]
    }
    with open(output_dir / "manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    print(f"\n📁 Artefactos generados en: {output_dir}")
    print(f"   • {raw_path.name}: {len(raw_records)} registros")
    print(f"   • {es_path.name}: {len(es_records)} registros")
    print(f"   • {rag_path.name}: {len(children)} micro-tarjetas RAG")
    print(f"   • {sft_path.name}: {len(chatml_pairs)} pares ChatML para Fine-Tuning")
    print("=======================================================\n")

    return {
        "unit": unit_key,
        "children": children,
        "chatml_pairs": chatml_pairs,
        "raw_records": raw_records,
        "es_records": es_records,
        "manifest": manifest
    }


def consolidate_subject(asignatura: str = "alimentacion-equilibrada"):
    """
    Consolida todos los datasets de las unidades procesadas en un único corpus unificado.
    """
    base_dir = Path("data/datasets") / asignatura
    consolidated_dir = base_dir / "consolidated"
    consolidated_dir.mkdir(parents=True, exist_ok=True)

    all_chatml = []
    all_rag = []
    total_words = 0
    total_pages = 0
    units_included = []

    for unit_dir in sorted(base_dir.iterdir()):
        if not unit_dir.is_dir() or unit_dir.name == "consolidated":
            continue

        chatml_file = unit_dir / "sft_chatml.jsonl"
        rag_file = unit_dir / "rag_embeddings.jsonl"
        manifest_file = unit_dir / "manifest.json"

        if chatml_file.exists() and rag_file.exists():
            units_included.append(unit_dir.name)
            with open(chatml_file, "r", encoding="utf-8") as f:
                all_chatml.extend([l.strip() for l in f if l.strip()])
            with open(rag_file, "r", encoding="utf-8") as f:
                all_rag.extend([l.strip() for l in f if l.strip()])

        if manifest_file.exists():
            with open(manifest_file, "r", encoding="utf-8") as f:
                m = json.load(f)
                total_words += m.get("total_palabras_hijos", 0)
                total_pages += m.get("paginas_pedagogicas", 0)

    # Escribir consolidados
    sft_full_path = consolidated_dir / "sft_chatml_full.jsonl"
    with open(sft_full_path, "w", encoding="utf-8") as f:
        f.write("\n".join(all_chatml) + "\n")

    rag_full_path = consolidated_dir / "rag_embeddings_full.jsonl"
    with open(rag_full_path, "w", encoding="utf-8") as f:
        f.write("\n".join(all_rag) + "\n")

    subject_manifest = {
        "asignatura": asignatura,
        "unidades_procesadas": units_included,
        "total_unidades": len(units_included),
        "total_paginas_pedagogicas": total_pages,
        "total_micro_chunks_rag": len(all_rag),
        "total_pares_chatml_sft": len(all_chatml),
        "total_palabras_corpus": total_words
    }
    with open(consolidated_dir / "manifest_subject.json", "w", encoding="utf-8") as f:
        json.dump(subject_manifest, f, indent=2, ensure_ascii=False)

    print(f"\n🏆 CORPUS CONSOLIDADO GENERADO CON ÉXITO:")
    print(f"   • Unidades unificadas: {', '.join(units_included)}")
    print(f"   • Total micro-chunks RAG: {len(all_rag)}")
    print(f"   • Total pares ChatML SFT: {len(all_chatml)}")
    print(f"   • Total palabras: {total_words:,}")
    print(f"   • Ubicación: {consolidated_dir}\n")


def ingest_all(asignatura: str = "alimentacion-equilibrada"):
    """Procesa en lote las 11 unidades didácticas y las consolida."""
    print(f"📦 INICIANDO INGESTA COMPLETA DE TODA LA ASIGNATURA: {asignatura.upper()}")
    for key in SUBJECT_CATALOG.keys():
        try:
            ingest_unit(key, asignatura=asignatura)
        except Exception as e:
            print(f"⚠️ Error procesando {key}: {e}. Continuando con la siguiente...")

    consolidate_subject(asignatura=asignatura)


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args or args[0] in ["--all", "-a", "all"]:
        ingest_all()
    elif args[0] in ["--consolidate", "-c"]:
        consolidate_subject()
    else:
        for u in args:
            try:
                ingest_unit(u)
            except Exception as e:
                print(f"⚠️ Error procesando {u}: {e}")
        consolidate_subject()
