"use client";

import { FormEvent, useEffect, useState } from "react";
import { ServerWorkspace } from "@/components/ServerWorkspace";
import { ConsoleView } from "@/components/ConsoleView";

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

const softwareOptions: Array<{ value: ServerSoftware; label: string; hint: string }> = [
  { value: "paper", label: "Paper", hint: "Alta performance + Plugins (Recomendado)." },
  { value: "fabric", label: "Fabric", hint: "Leve e moderno para mods." },
  { value: "forge", label: "Forge", hint: "O clássico para grandes modpacks." },
  { value: "bedrock", label: "Bedrock", hint: "Oficial para Celular/Console." },
  { value: "purpur", label: "Purpur", hint: "Paper com mais customizações." },
  { value: "quilt", label: "Quilt", hint: "Alternativa moderna ao Fabric." },
  { value: "spigot", label: "Spigot", hint: "Clássico. Requer compilação." },
  { value: "vanilla", label: "Vanilla", hint: "Oficial sem modificações." },
  { value: "custom", label: "Custom", hint: "Link de download próprio." },
];

export function Dashboard() {
  const [servers, setServers] = useState<ServerEntry[]>([]);
  const [selectedServer, setSelectedServer] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [serverName, setServerName] = useState("Galilandia");
  const [software, setSoftware] = useState<ServerSoftware>("paper");
  const [version, setVersion] = useState("latest");
  const [jarUrl, setJarUrl] = useState("");
  const [feedback, setFeedback] = useState("Bem-vindo ao seu painel Creeper!");
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    void refreshServers();
  }, []);

  async function refreshServers() {
    const response = await fetch("/api/server/install");
    const payload = (await response.json()) as { servers?: ServerEntry[] };
    const nextServers = payload.servers ?? [];
    setServers(nextServers);
    
    if (nextServers.length > 0 && !selectedServer) {
      setSelectedServer(nextServers[0].name);
    }
  }

  async function handleServerDeleted(name: string) {
    setFeedback(`Servidor ${name} removido.`);
    await refreshServers();
    setSelectedServer("");
  }

  async function installServer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsInstalling(true);
    setFeedback(`Preparando o terreno para ${serverName}...`);
    
    const response = await fetch("/api/server/install", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serverName, software, version, jarUrl }),
    });
    
    const payload = (await response.json()) as InstallResponse;
    setIsInstalling(false);
    
    if (!payload.ok) {
      setFeedback(payload.error ?? "Ops! Algo deu errado na explosão.");
      return;
    }
    
    setFeedback(payload.message ?? "Servidor pronto para a aventura!");
    setIsModalOpen(false);
    setSelectedServer(payload.server?.name ?? serverName);
    await refreshServers();
  }

  const currentServer = servers.find((s) => s.name === selectedServer);

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-[1400px] mx-auto">
      {/* Header Creeper */}
      <header className="creeper-glass rounded-3xl p-8 mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="h-20 w-20 bg-emerald-500 rounded-2xl flex flex-col items-center justify-center shadow-[0_6px_0_#166534] border-2 border-emerald-400">
            <div className="flex gap-2 mb-2">
              <div className="h-3 w-3 bg-emerald-950 rounded-sm" />
              <div className="h-3 w-3 bg-emerald-950 rounded-sm" />
            </div>
            <div className="h-4 w-6 bg-emerald-950 rounded-t-sm" />
          </div>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter text-emerald-400">Creeper Panel</h1>
            <p className="text-emerald-600 font-mono text-sm mt-1">{feedback}</p>
          </div>
        </div>
        
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-8 py-4 bg-emerald-500 text-emerald-950 font-black uppercase tracking-widest rounded-2xl hover:bg-emerald-400 transition-all shadow-[0_6px_0_#166534] active:translate-y-[2px] active:shadow-[0_4px_0_#166534]"
        >
          + Novo Servidor
        </button>
      </header>

      <div className="grid lg:grid-cols-[320px_1fr] gap-8">
        {/* Sidebar: Lista de Servidores */}
        <aside className="space-y-6">
          <div className="creeper-glass rounded-3xl p-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-500/60 mb-6">Seus Mundos</h2>
            <div className="space-y-3">
              {servers.length === 0 ? (
                <div className="py-8 text-center text-emerald-500/20 font-mono text-sm border-2 border-dashed border-emerald-500/10 rounded-2xl">
                  Nenhum mundo criado
                </div>
              ) : (
                servers.map((server) => (
                  <button
                    key={server.name}
                    onClick={() => setSelectedServer(server.name)}
                    className={`w-full p-4 rounded-2xl text-left transition-all border-2 ${
                      selectedServer === server.name
                        ? "bg-emerald-500/10 border-emerald-500 shadow-lg shadow-emerald-500/10"
                        : "bg-black/20 border-transparent hover:border-emerald-500/30"
                    }`}
                  >
                    <p className="font-bold text-emerald-100">{server.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-mono uppercase text-emerald-500/60">{server.software}</span>
                      <span className="h-1 w-1 rounded-full bg-emerald-500/30" />
                      <span className="text-[10px] font-mono text-emerald-500/60">{server.version}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="creeper-glass rounded-3xl p-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-500/60 mb-4">Estatísticas</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-emerald-950/30 p-4 rounded-2xl border border-emerald-500/10">
                <p className="text-[10px] font-bold text-emerald-500/40 uppercase">Nodes</p>
                <p className="text-xl font-black text-emerald-100">{servers.length}</p>
              </div>
              <div className="bg-emerald-950/30 p-4 rounded-2xl border border-emerald-500/10">
                <p className="text-[10px] font-bold text-emerald-500/40 uppercase">Ativos</p>
                <p className="text-xl font-black text-emerald-100">{servers.filter(s => s.installed).length}</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="space-y-8">
          {selectedServer && currentServer ? (
            <>
              <ServerWorkspace
                serverName={selectedServer}
                defaultVersion={currentServer.version}
                onFeedback={setFeedback}
                onServerDeleted={handleServerDeleted}
              />
              <ConsoleView serverName={selectedServer} />
            </>
          ) : (
            <div className="creeper-glass rounded-[40px] p-20 text-center">
              <div className="h-32 w-32 bg-emerald-900/20 rounded-full mx-auto mb-8 flex items-center justify-center border-4 border-dashed border-emerald-500/20">
                <div className="h-12 w-12 bg-emerald-500/20 rounded-lg animate-bounce" />
              </div>
              <h2 className="text-2xl font-black text-emerald-100 uppercase mb-4">Nenhum Servidor Selecionado</h2>
              <p className="text-emerald-500/60 max-w-md mx-auto">
                Crie um novo servidor ou selecione um na lista ao lado para começar a gerenciar seu mundo.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Criação */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-emerald-950/80 backdrop-blur-md">
          <div className="creeper-glass w-full max-w-xl rounded-[32px] p-8 shadow-2xl border-2 border-emerald-500/30">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black text-emerald-100 uppercase">Novo Mundo</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-emerald-500 hover:text-emerald-400 font-bold">Fechar</button>
            </div>

            <form onSubmit={installServer} className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-emerald-500/50 mb-3">Nome do Servidor</label>
                <input
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  className="w-full bg-black/40 border-2 border-emerald-500/10 rounded-2xl px-6 py-4 text-emerald-100 outline-none focus:border-emerald-500/40 transition-all"
                  placeholder="Ex: Survival Fofinho"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-emerald-500/50 mb-3">Software</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {softwareOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSoftware(opt.value)}
                      className={`p-4 rounded-2xl text-center border-2 transition-all ${
                        software === opt.value
                          ? "bg-emerald-500 border-emerald-400 text-emerald-950 font-bold"
                          : "bg-black/20 border-emerald-500/10 text-emerald-500/60 hover:border-emerald-500/30"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-emerald-500/50 mb-3">Versão</label>
                  <input
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    className="w-full bg-black/40 border-2 border-emerald-500/10 rounded-2xl px-6 py-4 text-emerald-100 outline-none focus:border-emerald-500/40 transition-all"
                    placeholder="latest"
                  />
                </div>
                <div className="bg-emerald-500/5 rounded-2xl p-4 border border-emerald-500/10 flex items-center">
                  <p className="text-[10px] text-emerald-500/60 leading-relaxed">
                    {softwareOptions.find(o => o.value === software)?.hint}
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={isInstalling}
                className="w-full py-5 bg-emerald-500 text-emerald-950 font-black uppercase tracking-widest rounded-2xl hover:bg-emerald-400 transition-all shadow-[0_6px_0_#166534] disabled:opacity-50"
              >
                {isInstalling ? "Gerando Mundo..." : "Criar Servidor"}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
