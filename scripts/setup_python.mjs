#!/usr/bin/env node
/**
 * Bootstrap reproducible del entorno virtual Python para cerebro-py.
 * Funciona en Windows, macOS y Linux sin depender de sintaxis de shell específica.
 */

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const cerebroDir = path.join(rootDir, "cerebro-py");
const venvDir = path.join(cerebroDir, ".venv");
const isWin = process.platform === "win32";
const venvPython = isWin
  ? path.join(venvDir, "Scripts", "python.exe")
  : path.join(venvDir, "bin", "python");

function findSystemPython() {
  const candidates = isWin ? ["python", "py"] : ["python3", "python"];
  for (const cmd of candidates) {
    const args = cmd === "py" ? ["-3", "--version"] : ["--version"];
    const res = spawnSync(cmd, args, { stdio: "pipe", encoding: "utf-8" });
    if (res.status === 0) {
      return { cmd, prefixArgs: cmd === "py" ? ["-3"] : [] };
    }
  }
  return null;
}

function runOrExit(cmd, args, cwd) {
  const res = spawnSync(cmd, args, { cwd, stdio: "inherit" });
  if (res.status !== 0) {
    process.exit(res.status ?? 1);
  }
}

console.log("[setup:py] Verificando entorno virtual en cerebro-py/.venv...");

if (!existsSync(venvPython)) {
  const sysPy = findSystemPython();
  if (!sysPy) {
    console.error("[setup:py] ERROR: No se encontró Python 3 en el PATH. Instala Python >= 3.12.");
    process.exit(1);
  }
  console.log("[setup:py] Creando cerebro-py/.venv...");
  runOrExit(sysPy.cmd, [...sysPy.prefixArgs, "-m", "venv", ".venv"], cerebroDir);
} else {
  console.log("[setup:py] Entorno virtual existente detectado.");
}

console.log("[setup:py] Instalando dependencias desde cerebro-py/requirements.txt...");
runOrExit(venvPython, ["-m", "pip", "install", "-r", "requirements.txt"], cerebroDir);

console.log("[setup:py] Listo. Entorno cerebro-py/.venv preparado.");
