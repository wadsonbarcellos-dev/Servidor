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
        serverName: serverName.trim(),
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
      body: JSON.stringify({ action: "start", serverName: serverName.trim() }),
    });

    const payload = (await response.json()) as { message?: string; error?: string; ok: boolean };
    setLines((current) => [...current, `[painel] ${payload.message ?? payload.error ?? "Atualizado."}`].slice(-50));
  }

  async function stopServer() {
    const response = await fetch("/api/server/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stop", serverName: serverName.trim() }),
    });

    const payload = (await response.json()) as { message?: string; error?: string; ok: boolean };
    setLines((current) => [...current, `[painel] ${payload.message ?? payload.error ?? "Atualizado."}`].slice(-50));
  }

  return (
    <section className="rounded-xl border border-emerald-500/30 bg-zinc-950/90 shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between bg-emerald-900/20 px-4 py-3 border-b border-emerald-500/20">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">Console do Servidor</p>
          <p className="text-[10px] text-emerald-600 font-mono">Status: {status}</p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={startServer}
            className="px-4 py-1.5 text-xs font-bold uppercase tracking-tighter rounded-lg bg-emerald-500 text-emerald-950 hover:bg-emerald-400 transition-all shadow-[0_3px_0_#065f46] active:translate-y-[2px] active:shadow-none"
          >
            Start
          </button>
          <button
            type="button"
            onClick={stopServer}
            className="px-4 py-1.5 text-xs font-bold uppercase tracking-tighter rounded-lg bg-red-500 text-red-950 hover:bg-red-400 transition-all shadow-[0_3px_0_#991b1b] active:translate-y-[2px] active:shadow-none"
          >
            Stop
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="h-[450px] overflow-y-auto bg-black/80 px-4 py-4 font-mono text-sm leading-relaxed text-emerald-400 scrollbar-thin scrollbar-thumb-emerald-900"
      >
        {lines.map((line, index) => (
          <div key={`${index}-${line.slice(0, 24)}`} className="whitespace-pre-wrap break-words mb-1">
            <span className="opacity-50 mr-2">❯</span>
            {line}
          </div>
        ))}
      </div>

      <form onSubmit={sendCommand} className="bg-emerald-950/30 p-4 border-t border-emerald-500/10">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500/50 font-mono">/</span>
            <input
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              placeholder="Digite um comando..."
              className="w-full rounded-lg border border-emerald-500/20 bg-black/40 pl-7 pr-3 py-2.5 font-mono text-sm text-emerald-100 outline-none focus:border-emerald-500/50 transition-all"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-2.5 text-sm font-bold uppercase rounded-lg bg-emerald-600 text-emerald-50 hover:bg-emerald-500 transition-all"
          >
            Enviar
          </button>
        </div>
      </form>
    </section>
  );
}
