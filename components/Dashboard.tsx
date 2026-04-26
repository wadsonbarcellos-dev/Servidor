"use client";

import { FormEvent, useEffect, useState } from "react";
import { ConsoleView } from "@/components/ConsoleView";
import { ServerWorkspace } from "@/components/ServerWorkspace";

type ServerSoftware = "vanilla" | "paper" | "purpur" | "spigot" | "custom";

type ServerEntry = {
  name: string;
  path: string;
  installed: boolean;
  hasLogs: boolean;
  software?: ServerSoftware;
  version?: string;
  build?: string;
};

type InstallResponse = {
  ok: boolean;
  message?: string;
  error?: string;
  server?: ServerEntry;
};

const softwareOptions: Array<{
  value: ServerSoftware;
  label: string;
  hint: string;
}> = [
  { value: "paper", label: "Paper", hint: "Melhor escolha para plugins e performance." },
  { value: "purpur", label: "Purpur", hint: "Baseado em Paper com mais configuracoes." },
  { value: "spigot", label: "Spigot", hint: "Compilado via BuildTools. Mais lento para instalar." },
  { value: "vanilla", label: "Vanilla", hint: "Servidor oficial da Mojang." },
  { value: "custom", label: "Custom URL", hint: "Baixa qualquer server.jar informado por voce." },
];

export function Dashboard() {
  const [servers, setServers] = useState<ServerEntry[]>([]);
  const [selectedServer, setSelectedServer] = useState("survival");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [serverName, setServerName] = useState("survival");
  const [software, setSoftware] = useState<ServerSoftware>("paper");
  const [version, setVersion] = useState("latest");
  const [jarUrl, setJarUrl] = useState("");
  const [feedback, setFeedback] = useState("Pronto para instalar um servidor.");
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    void refreshServers();
  }, []);

  async function refreshServers() {
    const response = await fetch("/api/server/install");
    const payload = (await response.json()) as { servers?: ServerEntry[] };
    const nextServers = payload.servers ?? [];
    setServers(nextServers);

    if (nextServers.length > 0) {
      setSelectedServer((current) =>
        nextServers.some((server) => server.name === current) ? current : nextServers[0].name
      );
    } else {
      setSelectedServer("");
    }
  }

  async function handleServerDeleted(name: string) {
    setFeedback(`Servidor ${name} removido.`);
    await refreshServers();
  }

  async function installServer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsInstalling(true);
    setFeedback(`Instalando ${software} ${version} no workspace...`);

    const response = await fetch("/api/server/install", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serverName, software, version, jarUrl }),
    });

    const payload = (await response.json()) as InstallResponse;
    setIsInstalling(false);

    if (!payload.ok) {
      setFeedback(payload.error ?? "Falha ao instalar o servidor.");
      return;
    }

    setFeedback(payload.message ?? "Servidor instalado com sucesso.");
    setIsModalOpen(false);
    setSelectedServer(payload.server?.name ?? serverName);
    await refreshServers();
  }

  const currentServer = servers.find((server) => server.name === selectedServer);
  const currentSoftware = softwareOptions.find((option) => option.value === software);
  const installedServers = servers.filter((server) => server.installed).length;
  const softwareCount = new Set(servers.map((server) => server.software).filter(Boolean)).size;
  const sidebarLinks = [
    { label: "Overview", value: `${servers.length} nodes` },
    { label: "Servers", value: `${installedServers} ready` },
    { label: "Console", value: currentServer ? currentServer.name : "offline" },
    { label: "Provisioning", value: "paper | purpur | spigot" },
  ];

  return (
    <main className="min-h-screen bg-grid bg-[size:32px_32px]">
      <div className="mx-auto grid min-h-screen max-w-[1600px] gap-6 px-4 py-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-6">
        <aside className="rounded-lg border border-emerald-500/20 bg-panel-950/85 p-4 shadow-glow backdrop-blur">
          <div className="rounded-lg border border-emerald-500/20 bg-black/30 p-4">
            <p className="text-[11px] uppercase tracking-[0.45em] text-emerald-400">Codespace Panel</p>
            <h1 className="mt-3 text-2xl font-semibold text-zinc-100">Minecraft Ops</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Painel privado para instalar jars, iniciar processos persistentes e acompanhar logs no mesmo workspace.
            </p>
          </div>

          <nav className="mt-4 space-y-2">
            {sidebarLinks.map((link, index) => (
              <div
                key={link.label}
                className={`rounded-lg border px-4 py-3 ${
                  index === 0 ? "border-emerald-500/35 bg-emerald-500/10" : "border-zinc-800 bg-black/20"
                }`}
              >
                <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">{link.label}</p>
                <p className="mt-2 text-sm font-semibold text-zinc-100">{link.value}</p>
              </div>
            ))}
          </nav>

          <div className="mt-4 rounded-lg border border-zinc-800 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.3em] text-emerald-400">Supported</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {softwareOptions.map((option) => (
                <span
                  key={option.value}
                  className="rounded border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-zinc-400"
                >
                  {option.label}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 transition hover:bg-emerald-500/20"
            >
              + Criar Novo Servidor
            </button>
            <button
              type="button"
              onClick={() => void refreshServers()}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-200 transition hover:border-zinc-500"
            >
              Atualizar Lista
            </button>
          </div>
        </aside>

        <section className="flex min-w-0 flex-col gap-6">
          <header className="rounded-lg border border-emerald-500/20 bg-panel-950/80 p-5 shadow-glow backdrop-blur">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.45em] text-emerald-400">Control Surface</p>
                <h2 className="text-3xl font-semibold text-zinc-100">Operacao local no Codespaces</h2>
                <p className="max-w-3xl text-sm leading-6 text-zinc-400">
                  Inspirado em paineis como o Crafty, mas enxuto e pessoal: foco em provisionamento, start/stop e console sem login.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[420px]">
                <div className="rounded-lg border border-zinc-800 bg-black/25 p-4">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">Servidor ativo</p>
                  <p className="mt-2 text-lg font-semibold text-zinc-100">{currentServer?.name ?? "Nenhum"}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-emerald-400">
                    {currentServer?.software ?? "standby"}
                    {currentServer?.version ? ` ${currentServer.version}` : ""}
                  </p>
                </div>

                <div className="rounded-lg border border-zinc-800 bg-black/25 p-4">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">Activity Feed</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{feedback}</p>
                </div>
              </div>
            </div>
          </header>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-emerald-500/20 bg-panel-950/80 p-4 shadow-glow backdrop-blur">
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">Servidores</p>
              <p className="mt-2 text-3xl font-semibold text-zinc-100">{servers.length}</p>
              <p className="mt-1 text-xs text-zinc-500">entradas registradas no workspace</p>
            </div>

            <div className="rounded-lg border border-emerald-500/20 bg-panel-950/80 p-4 shadow-glow backdrop-blur">
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">Instalados</p>
              <p className="mt-2 text-3xl font-semibold text-zinc-100">{installedServers}</p>
              <p className="mt-1 text-xs text-zinc-500">com `server.jar` pronto para iniciar</p>
            </div>

            <div className="rounded-lg border border-emerald-500/20 bg-panel-950/80 p-4 shadow-glow backdrop-blur">
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">Softwares</p>
              <p className="mt-2 text-3xl font-semibold text-zinc-100">{softwareCount}</p>
              <p className="mt-1 text-xs text-zinc-500">Paper, Purpur, Spigot, Vanilla e custom</p>
            </div>

            <div className="rounded-lg border border-emerald-500/20 bg-panel-950/80 p-4 shadow-glow backdrop-blur">
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">Selecionado</p>
              <p className="mt-2 truncate text-xl font-semibold text-zinc-100">{currentServer?.name ?? "Nenhum"}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-emerald-400">
                {currentServer?.software ?? "aguardando instalacao"}
                {currentServer?.version ? ` ${currentServer.version}` : ""}
              </p>
            </div>
          </section>

          <section className="grid gap-6 2xl:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="rounded-lg border border-emerald-500/20 bg-panel-950/80 p-4 shadow-glow backdrop-blur">
              <div className="mb-4">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-300">Servidores</p>
                <p className="text-xs text-zinc-500">{servers.length} encontrados</p>
              </div>

              <div className="space-y-3">
                {servers.length === 0 ? (
                  <div className="rounded border border-dashed border-zinc-800 bg-black/30 p-4 text-sm text-zinc-500">
                    Nenhum servidor instalado ainda.
                  </div>
                ) : null}

                {servers.map((server) => {
                  const active = server.name === selectedServer;
                  return (
                    <button
                      key={server.name}
                      type="button"
                      onClick={() => setSelectedServer(server.name)}
                      className={`w-full rounded border p-4 text-left transition ${
                        active
                          ? "border-emerald-500/50 bg-emerald-500/10"
                          : "border-zinc-800 bg-black/30 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-zinc-100">{server.name}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-emerald-400">
                            {server.software ?? "desconhecido"}
                            {server.version ? ` ${server.version}` : ""}
                          </p>
                          <p className="mt-1 truncate text-xs text-zinc-500">{server.path}</p>
                        </div>
                        <span
                          className={`rounded px-2 py-1 text-[10px] uppercase tracking-[0.25em] ${
                            server.installed ? "bg-emerald-500/10 text-emerald-300" : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {server.installed ? "Pronto" : "Vazio"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="space-y-6">
              {currentServer ? (
                <ServerWorkspace
                  serverName={selectedServer}
                  defaultVersion={currentServer.version}
                  onFeedback={setFeedback}
                  onServerDeleted={handleServerDeleted}
                />
              ) : null}

              {currentServer ? (
                <ConsoleView serverName={selectedServer} />
              ) : (
                <div className="rounded-lg border border-dashed border-zinc-800 bg-black/20 p-8 text-sm text-zinc-500">
                  Instale um servidor para habilitar o console em tempo real.
                </div>
              )}
            </section>
          </section>
        </section>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-lg border border-emerald-500/30 bg-panel-950 p-6 shadow-glow">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-emerald-400">Provisionamento</p>
                <h2 className="mt-2 text-2xl text-zinc-100">Criar Novo Servidor</h2>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-zinc-500"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={installServer} className="space-y-4">
              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.25em] text-zinc-500">Nome do servidor</label>
                <input
                  value={serverName}
                  onChange={(event) => setServerName(event.target.value)}
                  className="w-full rounded border border-zinc-800 bg-black/40 px-3 py-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-500/50"
                  placeholder="survival"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.25em] text-zinc-500">Software</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {softwareOptions.map((option) => {
                    const active = software === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSoftware(option.value)}
                        className={`rounded border p-3 text-left transition ${
                          active
                            ? "border-emerald-500/50 bg-emerald-500/10"
                            : "border-zinc-800 bg-black/30 hover:border-zinc-700"
                        }`}
                      >
                        <p className="text-sm font-semibold text-zinc-100">{option.label}</p>
                        <p className="mt-1 text-xs text-zinc-500">{option.hint}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.25em] text-zinc-500">Versao</label>
                  <input
                    value={version}
                    onChange={(event) => setVersion(event.target.value)}
                    className="w-full rounded border border-zinc-800 bg-black/40 px-3 py-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-500/50"
                    placeholder={software === "spigot" ? "1.21.5" : "latest"}
                    required={software !== "custom"}
                  />
                </div>

                <div className="rounded border border-zinc-800 bg-black/20 p-3 text-xs text-zinc-500">
                  <p className="uppercase tracking-[0.25em] text-emerald-400">{currentSoftware?.label}</p>
                  <p className="mt-2 leading-6">
                    {software === "spigot"
                      ? "Spigot nao tem download direto. O painel vai baixar o BuildTools e compilar o jar no Codespace."
                      : software === "custom"
                        ? "Use um link direto para o server.jar de qualquer distribuicao."
                        : "Use latest ou informe uma versao especifica, como 1.21.11."}
                  </p>
                </div>
              </div>

              {software === "custom" ? (
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.25em] text-zinc-500">URL do server.jar</label>
                  <input
                    value={jarUrl}
                    onChange={(event) => setJarUrl(event.target.value)}
                    className="w-full rounded border border-zinc-800 bg-black/40 px-3 py-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-500/50"
                    placeholder="https://..."
                    required
                  />
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isInstalling}
                className="w-full rounded border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isInstalling ? "Instalando..." : "Instalar"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
