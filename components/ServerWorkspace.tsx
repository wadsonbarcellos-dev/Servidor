"use client";

import { FormEvent, useEffect, useState } from "react";

type ServerWorkspaceProps = {
  serverName: string;
  defaultVersion?: string;
  onFeedback: (message: string) => void;
  onServerDeleted: (serverName: string) => Promise<void> | void;
};

type ServerStatusResponse = {
  ok: boolean;
  metadata?: {
    software?: string;
    version?: string;
    build?: string;
  } | null;
  stats?: {
    running: boolean;
    mode: string | null;
    pid: string | null;
    cpu: number | null;
    memoryMb: number | null;
    uptime: string | null;
    command: string | null;
    playitRunning?: boolean;
  };
};

type PluginsResponse = {
  ok: boolean;
  plugins?: Array<{ name: string; path: string }>;
  error?: string;
};

type FileEntry = {
  name: string;
  type: "file" | "directory";
  path: string;
};

type FileResponse = {
  ok: boolean;
  type?: "file" | "directory";
  path?: string;
  name?: string;
  content?: string;
  entries?: FileEntry[];
  error?: string;
};

type PluginSource = "hangar" | "modrinth" | "url";
type WorkspaceTab = "overview" | "plugins" | "files";

export function ServerWorkspace({ serverName, defaultVersion, onFeedback, onServerDeleted }: ServerWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");
  const [status, setStatus] = useState<ServerStatusResponse["stats"] | null>(null);
  const [plugins, setPlugins] = useState<Array<{ name: string; path: string }>>([]);
  const [pluginSource, setPluginSource] = useState<PluginSource>("hangar");
  const [pluginAuthor, setPluginAuthor] = useState("EssentialsX");
  const [pluginProject, setPluginProject] = useState("Essentials");
  const [pluginVersion, setPluginVersion] = useState("");
  const [pluginProjectId, setPluginProjectId] = useState("luckperms");
  const [pluginUrl, setPluginUrl] = useState("");
  const [pluginFilename, setPluginFilename] = useState("");
  const [pluginBusy, setPluginBusy] = useState(false);
  const [browserPath, setBrowserPath] = useState("");
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState("server.properties");
  const [selectedFileContent, setSelectedFileContent] = useState("");
  const [editorBusy, setEditorBusy] = useState(false);
  const [isDeletingServer, setIsDeletingServer] = useState(false);

  useEffect(() => {
    void refreshStatus();
    const timer = setInterval(() => {
      void refreshStatus();
    }, 5000);
    return () => clearInterval(timer);
  }, [serverName]);

  useEffect(() => {
    void refreshPlugins();
    void openPath("");
    void loadFile("server.properties");
  }, [serverName]);

  async function refreshStatus() {
    const response = await fetch(`/api/server/status?serverName=${encodeURIComponent(serverName)}`, {
      cache: "no-store",
    });
    const payload = (await response.json()) as ServerStatusResponse;
    if (payload.ok) {
      setStatus(payload.stats ?? null);
    }
  }

  async function refreshPlugins() {
    const response = await fetch(`/api/server/plugins?serverName=${encodeURIComponent(serverName)}`, {
      cache: "no-store",
    });
    const payload = (await response.json()) as PluginsResponse;
    if (payload.ok) {
      setPlugins(payload.plugins ?? []);
    }
  }

  async function openPath(path: string) {
    const response = await fetch(
      `/api/server/files?serverName=${encodeURIComponent(serverName)}&path=${encodeURIComponent(path)}`,
      { cache: "no-store" }
    );
    const payload = (await response.json()) as FileResponse;
    if (payload.ok && payload.type === "directory") {
      setBrowserPath(payload.path ?? "");
      setFileEntries(payload.entries ?? []);
    }
  }

  async function loadFile(path: string) {
    const response = await fetch(
      `/api/server/files?serverName=${encodeURIComponent(serverName)}&path=${encodeURIComponent(path)}`,
      { cache: "no-store" }
    );
    const payload = (await response.json()) as FileResponse;
    if (payload.ok && payload.type === "file") {
      setSelectedFilePath(payload.path ?? path);
      setSelectedFileContent(payload.content ?? "");
      onFeedback(`Arquivo ${payload.path ?? path} carregado.`);
    } else if (!payload.ok) {
      onFeedback(payload.error ?? "Falha ao carregar arquivo.");
    }
  }

  async function installPlugin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPluginBusy(true);

    let body: Record<string, string> = { serverName, source: pluginSource };

    if (pluginSource === "hangar") {
      body = { ...body, author: pluginAuthor, project: pluginProject, version: pluginVersion };
    } else if (pluginSource === "modrinth") {
      body = {
        ...body,
        projectId: pluginProjectId,
        gameVersion: defaultVersion || "1.21.11",
        loader: "paper",
      };
    } else {
      body = { ...body, url: pluginUrl, filename: pluginFilename };
    }

    const response = await fetch("/api/server/plugins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const payload = (await response.json()) as { ok: boolean; message?: string; error?: string };
    setPluginBusy(false);

    onFeedback(payload.message ?? payload.error ?? "Atualizado.");
    if (payload.ok) {
      await refreshPlugins();
      await openPath("plugins");
    }
  }

  async function saveSelectedFile() {
    setEditorBusy(true);
    const response = await fetch("/api/server/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serverName,
        path: selectedFilePath,
        content: selectedFileContent,
      }),
    });

    const payload = (await response.json()) as { ok: boolean; message?: string; error?: string };
    setEditorBusy(false);
    onFeedback(payload.message ?? payload.error ?? "Arquivo atualizado.");
  }

  async function deleteCurrentServer() {
    const typedName = window.prompt(`Digite o nome do servidor para confirmar a exclusao: ${serverName}`);
    if (typedName == null) return;

    if (typedName.trim() !== serverName) {
      onFeedback("Confirmacao incorreta. Servidor nao removido.");
      return;
    }

    setIsDeletingServer(true);
    const response = await fetch("/api/server/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serverName, confirmName: typedName.trim() }),
    });
    const payload = (await response.json()) as { ok: boolean; message?: string; error?: string };
    setIsDeletingServer(false);

    onFeedback(payload.message ?? payload.error ?? "Atualizado.");
    if (payload.ok) {
      await onServerDeleted(serverName);
    }
  }

  const parentPath = browserPath.includes("/")
    ? browserPath.split("/").slice(0, -1).join("/")
    : "";

  return (
    <section className="space-y-6">
      <div className="creeper-glass rounded-2xl p-2 flex gap-2">
        {(["overview", "plugins", "files"] as WorkspaceTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-sm font-bold uppercase tracking-widest rounded-xl transition-all ${
              activeTab === tab
                ? "bg-emerald-500 text-emerald-950 shadow-lg"
                : "text-emerald-500/60 hover:bg-emerald-500/10"
            }`}
          >
            {tab === "overview" ? "Visão Geral" : tab === "plugins" ? "Plugins" : "Arquivos"}
          </button>
        ))}
      </div>

      {activeTab === "overview" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Status" value={status?.running ? "Online" : "Offline"} accent={status?.running} />
          <StatCard label="Playit.gg" value={status?.playitRunning ? "Ativo" : "Inativo"} accent={status?.playitRunning} />
          <StatCard label="CPU" value={status?.cpu != null ? `${status.cpu}%` : "-"} />
          <StatCard label="RAM" value={status?.memoryMb != null ? `${status.memoryMb} MB` : "-"} />
          <StatCard label="PID" value={status?.pid || "-"} />
          
          <div className="creeper-glass rounded-2xl p-6 md:col-span-2 xl:col-span-5">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-500/60">Tempo de Atividade</p>
                <p className="mt-1 text-lg font-mono text-emerald-100">{status?.uptime || "Servidor parado"}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <div className={`h-3 w-3 rounded-full ${status?.running ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-700'}`} />
              </div>
            </div>

            <p className="text-xs font-bold uppercase tracking-widest text-emerald-500/60 mb-4">Ações Rápidas</p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void loadFile("server.properties")}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-900/40 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-900/60 transition-all"
              >
                Configurações
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("files");
                  void openPath("plugins");
                }}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-900/40 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-900/60 transition-all"
              >
                Pasta Plugins
              </button>
              <button
                type="button"
                onClick={() => void deleteCurrentServer()}
                disabled={isDeletingServer}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-red-900/20 text-red-400 border border-red-500/20 hover:bg-red-900/40 transition-all disabled:opacity-50"
              >
                {isDeletingServer ? "Excluindo..." : "Excluir Servidor"}
              </button>
            </div>
            
            <div className="mt-6 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/40 mb-2">Dica de Otimização</p>
              <p className="text-xs text-emerald-100/70 leading-relaxed">
                O servidor está usando <strong>Aikar's Flags</strong> e <strong>G1GC</strong> para minimizar o uso de RAM e evitar travamentos.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "plugins" ? (
        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <form
            onSubmit={installPlugin}
            className="creeper-glass rounded-2xl p-6"
          >
            <p className="text-sm font-bold uppercase tracking-widest text-emerald-400 mb-6">Instalar Plugin</p>
            <div className="flex gap-2 mb-6">
              {(["hangar", "modrinth", "url"] as PluginSource[]).map((source) => (
                <button
                  key={source}
                  type="button"
                  onClick={() => setPluginSource(source)}
                  className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all ${
                    pluginSource === source
                      ? "bg-emerald-500 text-emerald-950"
                      : "bg-emerald-950/40 text-emerald-500/60 hover:bg-emerald-950/60"
                  }`}
                >
                  {source}
                </button>
              ))}
            </div>
            
            <div className="space-y-4">
              {pluginSource === "hangar" && (
                <>
                  <Field label="Autor"><input value={pluginAuthor} onChange={e => setPluginAuthor(e.target.value)} className={inputClass} /></Field>
                  <Field label="Projeto"><input value={pluginProject} onChange={e => setPluginProject(e.target.value)} className={inputClass} /></Field>
                </>
              )}
              {pluginSource === "modrinth" && (
                <Field label="ID do Projeto"><input value={pluginProjectId} onChange={e => setPluginProjectId(e.target.value)} className={inputClass} /></Field>
              )}
              {pluginSource === "url" && (
                <Field label="URL Direta"><input value={pluginUrl} onChange={e => setPluginUrl(e.target.value)} className={inputClass} /></Field>
              )}
            </div>

            <button
              type="submit"
              disabled={pluginBusy}
              className="mt-6 w-full py-3 bg-emerald-500 text-emerald-950 font-bold uppercase rounded-xl hover:bg-emerald-400 transition-all disabled:opacity-50"
            >
              {pluginBusy ? "Instalando..." : "Instalar Plugin"}
            </button>
          </form>

          <div className="creeper-glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm font-bold uppercase tracking-widest text-emerald-400">Plugins Ativos</p>
              <button onClick={() => void refreshPlugins()} className="text-xs font-bold text-emerald-500 hover:text-emerald-400">Atualizar</button>
            </div>
            <div className="grid gap-3">
              {plugins.length === 0 ? (
                <div className="py-12 text-center text-emerald-500/30 font-mono text-sm">Nenhum plugin encontrado</div>
              ) : (
                plugins.map((plugin) => (
                  <div key={plugin.path} className="bg-emerald-950/30 border border-emerald-500/10 rounded-xl p-4 flex items-center justify-between">
                    <span className="text-sm font-bold text-emerald-100">{plugin.name}</span>
                    <span className="text-[10px] font-mono text-emerald-500/50">.jar</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "files" ? (
        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="creeper-glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm font-bold uppercase tracking-widest text-emerald-400">Arquivos</p>
              <button onClick={() => void openPath(parentPath)} className="text-xs font-bold text-emerald-500">Voltar</button>
            </div>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
              {fileEntries.map((entry) => (
                <button
                  key={entry.path}
                  onClick={() => entry.type === "directory" ? void openPath(entry.path) : void loadFile(entry.path)}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/5 hover:border-emerald-500/30 transition-all"
                >
                  <span className="text-sm text-emerald-100 truncate">{entry.name}</span>
                  <span className={`text-[10px] font-bold uppercase ${entry.type === 'directory' ? 'text-emerald-500' : 'text-emerald-500/30'}`}>
                    {entry.type === "directory" ? "dir" : "file"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="creeper-glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-mono text-emerald-500/60 truncate">{selectedFilePath}</p>
              <button
                onClick={() => void saveSelectedFile()}
                disabled={editorBusy}
                className="px-6 py-2 bg-emerald-500 text-emerald-950 font-bold uppercase text-xs rounded-lg hover:bg-emerald-400 disabled:opacity-50"
              >
                {editorBusy ? "Salvando..." : "Salvar"}
              </button>
            </div>
            <textarea
              value={selectedFileContent}
              onChange={(e) => setSelectedFileContent(e.target.value)}
              className="w-full h-[500px] bg-black/40 border border-emerald-500/10 rounded-xl p-4 font-mono text-sm text-emerald-100 outline-none focus:border-emerald-500/30 transition-all"
              spellCheck={false}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function StatCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="creeper-glass rounded-2xl p-5 flex flex-col items-center text-center">
      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/50 mb-2">{label}</p>
      <p className={`text-xl font-black ${accent ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.4)]" : "text-emerald-100"}`}>
        {value}
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-bold uppercase tracking-widest text-emerald-500/50 mb-2 ml-1">{label}</span>
      {children}
    </label>
  );
}

const inputClass = "w-full bg-black/40 border border-emerald-500/10 rounded-xl px-4 py-3 text-sm text-emerald-100 outline-none focus:border-emerald-500/40 transition-all";
