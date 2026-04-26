import { promises as fs } from "fs";
import { NextRequest, NextResponse } from "next/server";
import { getServerMetadataPath, getSessionName, ServerMetadata } from "@/lib/minecraft";
import { resolveServerPath } from "@/lib/server-fs";
import { runBash } from "@/lib/shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  // Verificar se o playit está rodando
  const playitSessionName = `playit-${serverName.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  let playitRunning = false;
  if (mode !== "none") {
    if (mode === "tmux") {
      playitRunning = (await runBash(`tmux has-session -t ${playitSessionName}`)).code === 0;
    } else {
      playitRunning = (await runBash(`screen -list | grep -q "[.]${playitSessionName}[[:space:]]"`)).code === 0;
    }
  }

  if (!processQuery.stdout) {
    return { running, mode, pid: null, cpu: null, memoryMb: null, uptime: null, command: null, playitRunning };
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
    playitRunning,
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
