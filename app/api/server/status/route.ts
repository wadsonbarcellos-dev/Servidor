import { promises as fs } from "fs";
import { spawn } from "child_process";
import { NextRequest, NextResponse } from "next/server";
import { getServerMetadataPath, getSessionName, ServerMetadata } from "@/lib/minecraft";
import { resolveServerPath } from "@/lib/server-fs";

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

async function readMetadata(serverName: string): Promise<ServerMetadata | null> {
  try {
    const content = await fs.readFile(getServerMetadataPath(serverName), "utf8");
    return JSON.parse(content) as ServerMetadata;
  } catch {
    return null;
  }
}

async function getProcessStats(serverName: string) {
  const { serverDir } = resolveServerPath(serverName);
  const sessionName = getSessionName(serverName);

  const modeCheck = await runBash("if command -v tmux >/dev/null 2>&1; then echo tmux; elif command -v screen >/dev/null 2>&1; then echo screen; else echo none; fi");
  const mode = modeCheck.stdout.trim();

  let running = false;

  if (mode === "tmux") {
    running = (await runBash(`tmux has-session -t ${sessionName}`)).code === 0;
  } else if (mode === "screen") {
    running = (await runBash(`screen -list | grep -q "[.]${sessionName}[[:space:]]"`)).code === 0;
  }

  const processQuery = await runBash(
    `PID=$(pgrep -f ${JSON.stringify(`${serverDir}.*server.jar`)} | head -n 1); if [ -n "$PID" ]; then ps -p "$PID" -o pid=,%cpu=,rss=,etime=,comm=; fi`
  );

  if (!processQuery.stdout) {
    return { running, mode, pid: null, cpu: null, memoryMb: null, uptime: null, command: null };
  }

  const parts = processQuery.stdout.trim().split(/\s+/);
  const [pid, cpu, rss, uptime, ...commandParts] = parts;

  return {
    running,
    mode,
    pid: pid ?? null,
    cpu: cpu ? Number(cpu) : null,
    memoryMb: rss ? Math.round(Number(rss) / 1024) : null,
    uptime: uptime ?? null,
    command: commandParts.join(" ") || null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const serverName = request.nextUrl.searchParams.get("serverName")?.trim() || "survival";
    const [metadata, stats] = await Promise.all([readMetadata(serverName), getProcessStats(serverName)]);

    return NextResponse.json({
      ok: true,
      serverName,
      metadata,
      stats,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao consultar status do servidor.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

