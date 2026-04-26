import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";
import { NextRequest, NextResponse } from "next/server";
import { getServerDir, getSessionName, MC_SERVER_ROOT } from "@/lib/minecraft";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function runBash(command: string) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn("bash", ["-lc", command], {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 0, stdout: stdout.trim(), stderr: stderr.trim() }));
  });
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

async function stopServerProcesses(serverName: string, serverDir: string) {
  const sessionName = getSessionName(serverName);

  await runBash(`if command -v tmux >/dev/null 2>&1; then tmux send-keys -t ${sessionName} "stop" Enter || true; fi`);
  await runBash(`if command -v screen >/dev/null 2>&1; then screen -S ${sessionName} -X stuff "stop^M" || true; fi`);
  await runBash(`sleep 1; pgrep -f ${shellQuote(`${serverDir}.*server.jar`)} | xargs -r kill -15 || true`);
  await runBash(`sleep 1; pgrep -f ${shellQuote(`${serverDir}.*server.jar`)} | xargs -r kill -9 || true`);
  await runBash(`if command -v tmux >/dev/null 2>&1; then tmux kill-session -t ${sessionName} || true; fi`);
  await runBash(`if command -v screen >/dev/null 2>&1; then screen -S ${sessionName} -X quit || true; fi`);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { serverName?: string; confirmName?: string };
    const serverName = body.serverName?.trim();
    const confirmName = body.confirmName?.trim();

    if (!serverName) {
      return NextResponse.json({ ok: false, error: "Informe o nome do servidor." }, { status: 400 });
    }

    if (confirmName && confirmName !== serverName) {
      return NextResponse.json({ ok: false, error: "Confirmacao invalida para exclusao." }, { status: 400 });
    }

    const safeName = serverName.replace(/[^a-zA-Z0-9_-]/g, "-");
    const serverDir = getServerDir(safeName);
    const rootRelative = path.relative(MC_SERVER_ROOT, serverDir);

    if (rootRelative.startsWith("..") || path.isAbsolute(rootRelative)) {
      return NextResponse.json({ ok: false, error: "Caminho de exclusao invalido." }, { status: 400 });
    }

    await stopServerProcesses(safeName, serverDir);
    await fs.rm(serverDir, { recursive: true, force: true });

    return NextResponse.json({
      ok: true,
      message: `Servidor ${safeName} removido com sucesso.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao remover servidor.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
