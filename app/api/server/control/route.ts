import { promises as fs } from "fs";
import { spawn } from "child_process";
import { NextRequest, NextResponse } from "next/server";
import { getServerDir, getServerJar, getSessionName } from "@/lib/minecraft";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ControlAction = "start" | "stop" | "command" | "status";

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

async function sessionMode() {
  const tmuxCheck = await runBash("command -v tmux >/dev/null 2>&1");
  if (tmuxCheck.code === 0) return "tmux" as const;

  const screenCheck = await runBash("command -v screen >/dev/null 2>&1");
  if (screenCheck.code === 0) return "screen" as const;

  throw new Error("Nem tmux nem screen estao disponiveis no container.");
}

async function sessionIsRunning(mode: "tmux" | "screen", sessionName: string) {
  if (mode === "tmux") {
    const result = await runBash(`tmux has-session -t ${sessionName}`);
    return result.code === 0;
  }

  const result = await runBash(`screen -list | grep -q "[.]${sessionName}[[:space:]]"`);
  return result.code === 0;
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      action?: ControlAction;
      serverName?: string;
      command?: string;
      memory?: string;
    };

    const action = body.action ?? "status";
    const serverName = body.serverName?.trim() || "survival";
    const memory = body.memory?.trim() || "2G";
    const serverDir = getServerDir(serverName);
    const serverJar = getServerJar(serverName);
    const sessionName = getSessionName(serverName);
    const mode = await sessionMode();

    if (action === "status") {
      return NextResponse.json({ ok: true, running: await sessionIsRunning(mode, sessionName), mode, serverDir });
    }

    await fs.mkdir(serverDir, { recursive: true });

    if (action === "start") {
      await fs.access(serverJar);

      if (await sessionIsRunning(mode, sessionName)) {
        return NextResponse.json({ ok: true, running: true, mode, message: "Servidor ja esta em execucao." });
      }

      const launch = [
        "cd",
        shellQuote(serverDir),
        "&&",
        "mkdir -p logs",
        "&&",
        "touch eula.txt",
        "&&",
        `printf 'eula=true\\n' > eula.txt`,
        "&&",
        `java -Xmx${memory} -jar server.jar nogui`,
      ].join(" ");

      const command =
        mode === "tmux"
          ? `tmux new-session -d -s ${sessionName} ${shellQuote(launch)}`
          : `screen -dmS ${sessionName} bash -lc ${shellQuote(launch)}`;

      const result = await runBash(command);

      if (result.code !== 0) {
        return NextResponse.json(
          { ok: false, error: result.stderr || "Falha ao iniciar o servidor.", mode },
          { status: 500 }
        );
      }

      return NextResponse.json({ ok: true, running: true, mode, message: "Servidor iniciado em background." });
    }

    if (action === "stop") {
      if (!(await sessionIsRunning(mode, sessionName))) {
        return NextResponse.json({ ok: true, running: false, mode, message: "Servidor ja estava parado." });
      }

      const command =
        mode === "tmux"
          ? `tmux send-keys -t ${sessionName} "stop" Enter`
          : `screen -S ${sessionName} -X stuff "stop^M"`;

      const result = await runBash(command);

      if (result.code !== 0) {
        return NextResponse.json(
          { ok: false, error: result.stderr || "Falha ao enviar stop.", mode },
          { status: 500 }
        );
      }

      return NextResponse.json({ ok: true, running: false, mode, message: "Comando stop enviado." });
    }

    if (action === "command") {
      if (!body.command?.trim()) {
        return NextResponse.json({ ok: false, error: "Informe um comando." }, { status: 400 });
      }

      if (!(await sessionIsRunning(mode, sessionName))) {
        return NextResponse.json({ ok: false, error: "Servidor nao esta rodando.", mode }, { status: 409 });
      }

      const input = body.command.trim().replaceAll('"', '\\"');
      const command =
        mode === "tmux"
          ? `tmux send-keys -t ${sessionName} "${input}" Enter`
          : `screen -S ${sessionName} -X stuff "${input}^M"`;

      const result = await runBash(command);

      if (result.code !== 0) {
        return NextResponse.json(
          { ok: false, error: result.stderr || "Falha ao enviar comando.", mode },
          { status: 500 }
        );
      }

      return NextResponse.json({ ok: true, mode, message: "Comando enviado ao console." });
    }

    return NextResponse.json({ ok: false, error: "Acao invalida." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado ao controlar o servidor.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
