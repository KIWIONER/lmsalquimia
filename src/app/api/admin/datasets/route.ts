import { NextResponse, type NextRequest } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const asignatura = searchParams.get("asignatura") || "alimentacion-equilibrada";
    const unit = searchParams.get("unit") || "UD1";

    const subjectDir = path.join(process.cwd(), "data", "datasets", asignatura);
    
    // Obtener lista de unidades disponibles en disco
    let availableUnits: string[] = [];
    if (fs.existsSync(subjectDir)) {
      availableUnits = fs
        .readdirSync(subjectDir, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name)
        .sort((a, b) => {
          if (a === "consolidated") return 1;
          if (b === "consolidated") return -1;
          return a.localeCompare(b, undefined, { numeric: true });
        });
    }

    const baseDir = path.join(subjectDir, unit);

    if (!fs.existsSync(baseDir)) {
      return NextResponse.json(
        {
          error: `No se encontraron datasets para ${asignatura}/${unit}`,
          availableUnits,
        },
        { status: 404 }
      );
    }

    // 1. Leer Manifest
    const manifestPath = path.join(
      baseDir,
      unit === "consolidated" ? "manifest_subject.json" : "manifest.json"
    );
    const manifest = fs.existsSync(manifestPath)
      ? JSON.parse(fs.readFileSync(manifestPath, "utf-8"))
      : null;

    // 2. Leer Pares ChatML
    const chatmlPath = path.join(
      baseDir,
      unit === "consolidated" ? "sft_chatml_full.jsonl" : "sft_chatml.jsonl"
    );
    const chatmlPairs = fs.existsSync(chatmlPath)
      ? fs
          .readFileSync(chatmlPath, "utf-8")
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line))
      : [];

    // 3. Leer Micro-chunks RAG
    const ragPath = path.join(
      baseDir,
      unit === "consolidated" ? "rag_embeddings_full.jsonl" : "rag_embeddings.jsonl"
    );
    const ragChunks = fs.existsSync(ragPath)
      ? fs
          .readFileSync(ragPath, "utf-8")
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line))
      : [];

    // 4. Leer Traducción Castellano (solo para unidades individuales)
    const esPath = path.join(baseDir, "normalized_es.jsonl");
    const esRecords = fs.existsSync(esPath)
      ? fs
          .readFileSync(esPath, "utf-8")
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line))
      : [];

    // 5. Leer Original Gallego (solo para unidades individuales)
    const rawPath = path.join(baseDir, "raw_extracted.jsonl");
    const rawRecords = fs.existsSync(rawPath)
      ? fs
          .readFileSync(rawPath, "utf-8")
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line))
      : [];

    return NextResponse.json({
      success: true,
      unit,
      availableUnits,
      manifest,
      counts: {
        chatml: chatmlPairs.length,
        rag: ragChunks.length,
        pages: esRecords.length,
      },
      data: {
        chatmlPairs,
        ragChunks,
        esRecords,
        rawRecords,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
