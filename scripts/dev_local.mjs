#!/usr/bin/env node
/**
 * Orquestador de arranque local para Alquimia LMS (Next.js + cerebro-py).
 *
 * Uso:
 *   node scripts/dev_local.mjs           -> Levanta Next.js (3100+) + cerebro-py (8155+)
 *   node scripts/dev_local.mjs --py-only -> Levanta únicamente cerebro-py (8155+)
 */

import { existsSync } from "node:fs";
import net from "node:net";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const cerebroDir = path.join(rootDir, "cerebro-py");
const isWin = process.platform === "win32";
const pyOnly = process.argv.includes("--py-only");

const host = process.env.CEREBRO_PY_HOST || "127.0.0.1";
const preferredPyPort = Number(process.env.CEREBRO_PY_PORT || 8155);
const preferredNextPort = Number(process.env.PORT || 3100);

function canBindPort(port, bindHost) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", (err) => {
      if (bindHost === "::" && (err.code === "EAFNOSUPPORT" || err.code === "EADDRNOTAVAIL")) {
        resolve(true);
        return;
      }
      resolve(false);
    });
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, bindHost);
  });
}

async function findAvailablePort(startPort, bindHosts, maxAttempts = 50) {
  const hosts = Array.isArray(bindHosts) ? bindHosts : [bindHosts];
  for (let offset = 0; offset < maxAttempts; offset++) {
    const candidate = startPort + offset;
    let allFree = true;
    for (const h of hosts) {
      if (!(await canBindPort(candidate, h))) {
        allFree = false;
        break;
      }
    }
    if (allFree) {
      return candidate;
    }
  }
  throw new Error(
    `No se encontró ningún puerto libre en [${hosts.join(", ")}] a partir de ${startPort} (probados ${maxAttempts}).`
  );
}

function resolvePython() {
  const venvPython = isWin
    ? path.join(cerebroDir, ".venv", "Scripts", "python.exe")
    : path.join(cerebroDir, ".venv", "bin", "python");

  if (existsSync(venvPython)) {
    return { bin: venvPython, isolated: true };
  }

  const candidates = isWin ? ["python", "python3"] : ["python3", "python"];
  for (const bin of candidates) {
    const check = spawnSync(bin, ["--version"], { stdio: "pipe" });
    if (check.status === 0) {
      return { bin, isolated: false };
    }
  }
  return null;
}

function prefixStream(stream, label) {
  if (!stream) return;
  let buffer = "";
  stream.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.length > 0) {
        process.stdout.write(`[${label}] ${line}\n`);
      }
    }
  });
  stream.on("end", () => {
    if (buffer.length > 0) {
      process.stdout.write(`[${label}] ${buffer}\n`);
    }
  });
}

function killTree(child) {
  if (!child || child.killed || !child.pid) return;
  if (isWin) {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
  }
}

async function main() {
  if (!existsSync(path.join(rootDir, ".env.local"))) {
    console.warn(
      "[dev] AVISO: No se encontró .env.local en la raíz. Copia .env.example a .env.local si necesitas Supabase/Auth."
    );
  }

  const py = resolvePython();
  if (!py) {
    console.error("[dev] ERROR: No se encontró Python 3. Instala Python >= 3.12 y ejecuta: npm run setup:py");
    process.exit(1);
  }

  if (!py.isolated) {
    console.warn(
      "[dev] AVISO: Usando Python global (no existe cerebro-py/.venv). Recomendado para entorno aislado: npm run setup:py"
    );
  }

  const pyPort = await findAvailablePort(preferredPyPort, host);
  if (pyPort !== preferredPyPort) {
    console.warn(
      `[dev] AVISO: Puerto ${preferredPyPort} ocupado o reservado por el sistema; usando puerto libre ${pyPort} para cerebro-py.`
    );
  }

  const nextPort = pyOnly ? null : await findAvailablePort(preferredNextPort, ["127.0.0.1", "::"]);
  if (!pyOnly && nextPort !== preferredNextPort) {
    console.warn(
      `[dev] AVISO: Puerto ${preferredNextPort} ocupado o reservado por el sistema; usando puerto libre ${nextPort} para Next.js.`
    );
  }

  const cerebroUrl = `http://${host}:${pyPort}`;
  const children = [];
  let shuttingDown = false;

  function shutdown(exitCode = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log("\n[dev] Deteniendo servicios locales...");
    for (const child of children) {
      killTree(child);
    }
    process.exit(exitCode);
  }

  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));

  // 1. Arrancar cerebro-py (opciones siempre antes del argumento posicional main:app)
  console.log(`[dev] Iniciando cerebro-py en ${cerebroUrl} (health: ${cerebroUrl}/health) ...`);
  const pyChild = spawn(
    py.bin,
    ["-m", "uvicorn", "--host", host, "--port", String(pyPort), "--reload", "main:app"],
    {
      cwd: cerebroDir,
      env: { ...process.env, CEREBRO_PY_HOST: host, CEREBRO_PY_PORT: String(pyPort) },
      stdio: ["ignore", "pipe", "pipe"],
      detached: !isWin,
    }
  );
  children.push(pyChild);
  prefixStream(pyChild.stdout, "cerebro-py");
  prefixStream(pyChild.stderr, "cerebro-py");

  pyChild.on("exit", (code) => {
    if (!shuttingDown) {
      console.error(`[cerebro-py] Proceso terminado con código ${code ?? 1}.`);
      shutdown(code ?? 1);
    }
  });

  // 2. Arrancar Next.js conectado automáticamente al puerto real de cerebro-py
  if (!pyOnly) {
    console.log(`[dev] Iniciando Next.js en http://localhost:${nextPort} (CEREBRO_PY_URL=${cerebroUrl}) ...`);
    const nextBin = path.join(rootDir, "node_modules", "next", "dist", "bin", "next");
    const nextEnv = {
      ...process.env,
      PORT: String(nextPort),
      CEREBRO_PY_URL: cerebroUrl,
      CEREBRO_PY_PORT: String(pyPort),
    };
    const nextChild = existsSync(nextBin)
      ? spawn(process.execPath, [nextBin, "dev", "-p", String(nextPort)], {
          cwd: rootDir,
          env: nextEnv,
          stdio: ["ignore", "pipe", "pipe"],
          detached: !isWin,
        })
      : spawn(isWin ? "npm.cmd" : "npm", ["run", "dev", "--", "-p", String(nextPort)], {
          cwd: rootDir,
          env: nextEnv,
          shell: isWin,
          stdio: ["ignore", "pipe", "pipe"],
          detached: !isWin,
        });
    children.push(nextChild);
    prefixStream(nextChild.stdout, "next");
    prefixStream(nextChild.stderr, "next");

    nextChild.on("exit", (code) => {
      if (!shuttingDown) {
        console.error(`[next] Proceso terminado con código ${code ?? 1}.`);
        shutdown(code ?? 1);
      }
    });
  }
}

main().catch((err) => {
  console.error(`[dev] ERROR fatal: ${err.message}`);
  process.exit(1);
});
