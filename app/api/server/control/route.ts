import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getServerDir, getServerJar, getSessionName } from "@/lib/minecraft";
import { runBash, shellQuote } from "@/lib/shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function sessionIsRunning(mode: "tmux" | "screen", sessionName: string) {
  const command = mode === "tmux" ? `tmux has-session -t ${sessionName}` : `screen -ls | grep -q "\\.${sessionName}"`;
  const result = await runBash(command);
  return result.code === 0;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { serverName, action, memory = "2G", mode = "tmux" } = body;

    if (!serverName || !action) {
      return NextResponse.json({ ok: false, error: "Informe serverName e action." }, { status: 400 });
    }

    const sessionName = getSessionName(serverName);
    const serverDir = getServerDir(serverName);
    const serverJar = getServerJar(serverName);

    if (action === "start") {
      if (await sessionIsRunning(mode, sessionName)) {
        return NextResponse.json({ ok: true, running: true, message: "Servidor já está em execução." });
      }

      const isBedrock = serverJar.endsWith("bedrock_server");
      let launch;

      if (isBedrock) {
        launch = [
          "cd", shellQuote(serverDir),
          "&&", "chmod +x bedrock_server",
          "&&", "LD_LIBRARY_PATH=. ./bedrock_server"
        ].join(" ");
      } else {
        // Aikar's Flags para Otimização Profissional de RAM
        const aikarFlags = [
          "-XX:+UseG1GC",
          "-XX:+ParallelRefProcEnabled",
          "-XX:MaxGCPauseMillis=200",
          "-XX:+UnlockExperimentalVMOptions",
          "-XX:+DisableExplicitGC",
          "-XX:+AlwaysPreTouch",
          "-XX:G1NewSizePercent=30",
          "-XX:G1MaxNewSizePercent=40",
          "-XX:G1HeapRegionSize=8M",
          "-XX:G1ReservePercent=20",
          "-XX:G1HeapWastePercent=5",
          "-XX:G1MixedGCCountTarget=4",
          "-XX:InitiatingHeapOccupancyPercent=15",
          "-XX:G1MixedGCLiveThresholdPercent=90",
          "-XX:G1RSetUpdatingPauseTimePercent=5",
          "-XX:SurvivorRatio=32",
          "-XX:+PerfDisableSharedMem",
          "-XX:MaxTenuringThreshold=1"
        ].join(" ");

        launch = [
          "cd", shellQuote(serverDir),
          "&&", "echo 'eula=true' > eula.txt",
          "&&", `java -Xms128M -Xmx${memory} ${aikarFlags} -jar server.jar nogui`
        ].join(" ");
      }

      // Iniciar Playit.gg em segundo plano se disponível
      const playitCommand = "tmux new-session -d -s playit-tunnel 'playit'";
      await runBash(playitCommand);

      const command = mode === "tmux" 
        ? `tmux new-session -d -s ${sessionName} ${shellQuote(launch)}`
        : `screen -dmS ${sessionName} bash -c ${shellQuote(launch)}`;

      const result = await runBash(command);
      if (result.code !== 0) throw new Error(result.stderr || "Falha ao iniciar sessão.");

      return NextResponse.json({ ok: true, message: "Servidor e Playit iniciados!" });
    }

    if (action === "stop") {
      const command = mode === "tmux" ? `tmux kill-session -t ${sessionName}` : `screen -S ${sessionName} -X quit`;
      await runBash(command);
      await runBash("tmux kill-session -t playit-tunnel 2>/dev/null");
      return NextResponse.json({ ok: true, message: "Servidor e túnel encerrados." });
    }

    return NextResponse.json({ ok: false, error: "Ação inválida." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
