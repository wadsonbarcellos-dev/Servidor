"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type ConsoleViewProps = {
  serverName: string;
};

export function ConsoleView({ serverName }: ConsoleViewProps) {
  const [lines, setLines] = useState<string[]>(["Conectando ao stream de logs..."]);
  const [command, setCommand] = useState("");
  const [status, setStatus] = useState("idle");
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const events = new EventSource(`/api/server/logs?serverName=${encodeURIComponent(serverName)}`);

    events.addEventListener("logs", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as { lines: string[] };
      setLines(payload.lines);
      setStatus("streaming");
    });

    events.onerror = () => {
      setStatus("offline");
    };

    return () => {
      events.close();
    };
  }, [serverName]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [lines]);

  async function sendCommand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalized = command.trim();
    if (!normalized) return;

    const response = await fetch("/api/server/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: normalized === "/stop" || normalized === "stop" ? "stop" : "command",
        command: normalized.replace(/^\//, ""),
        serverName,
      }),
    });

    const payload = (await response.json()) as { ok: boolean; error?: string };

    if (!payload.ok) {
      setLines((current) => [...current, `[painel] ${payload.error ?? "Falha ao enviar comando."}`].slice(-50));
      return;
    }

    setCommand("");
  }

  async function startServer() {
    const response = await fetch("/api/server/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start", serverName }),
    });

    const payload = (await response.json()) as { message?: string; error?: string; ok: boolean };
    setLines((current) => [...current, `[painel] ${payload.message ?? payload.error ?? "Atualizado."}`].slice(-50));
  }

  async function stopServer() {
    const response = await fetch("/api/server/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stop", serverName }),
    });

    const payload = (await response.json()) as { message?: string; error?: string; ok: boolean };
    setLines((current) => [...current, `[painel] ${payload.message ?? payload.error ?? "Atualizado."}`].slice(-50));
  }

  return (
    <section className="rounded-lg border border-emerald-500/30 bg-zinc-950 shadow-[0_0_40px_rgba(16,185,129,0.08)]">
      <div className="flex items-center justify-between border-b border-emerald-500/20 px-4 py-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-300">Console</p>
          <p className="text-xs text-zinc-500">stream: {status}</p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={startServer}
            className="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-200 transition hover:bg-emerald-500/20"
          >
            Start
          </button>
          <button
            type="button"
            onClick={stopServer}
            className="rounded border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-sm text-red-200 transition hover:bg-red-500/20"
          >
            Stop
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="h-[420px] overflow-y-auto bg-black px-4 py-4 font-mono text-sm leading-6 text-emerald-400"
      >
        {lines.map((line, index) => (
          <div key={`${index}-${line.slice(0, 24)}`} className="whitespace-pre-wrap break-words">
            {line}
          </div>
        ))}
      </div>

      <form onSubmit={sendCommand} className="border-t border-emerald-500/20 p-4">
        <label className="mb-2 block text-xs uppercase tracking-[0.25em] text-zinc-500">stdin</label>
        <div className="flex gap-2">
          <input
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            placeholder="/op wadso"
            className="flex-1 rounded border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-100 outline-none transition focus:border-emerald-500/50"
          />
          <button
            type="submit"
            className="rounded border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200 transition hover:bg-emerald-500/20"
          >
            Enviar
          </button>
        </div>
      </form>
    </section>
  );
}

