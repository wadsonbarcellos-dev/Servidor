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
      <div className="rounded-lg border border-emerald-500/20 bg-panel-950/80 p-4 shadow-glow backdrop-blur">
        <div className="flex flex-wrap gap-2">
          {(["overview", "plugins", "files"] as WorkspaceTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded border px-3 py-2 text-sm transition ${
                activeTab === tab
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
                  : "border-zinc-800 bg-black/20 text-zinc-400 hover:border-zinc-700"
              }`}
            >
              {tab === "overview" ? "Visao Geral" : tab === "plugins" ? "Plugins" : "Arquivos"}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "overview" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Status" value={status?.running ? "Running" : "Stopped"} accent={status?.running} />
          <StatCard label="Modo" value={status?.mode || "-"} />
          <StatCard label="PID" value={status?.pid || "-"} />
          <StatCard label="CPU" value={status?.cpu != null ? `${status.cpu}%` : "-"} />
          <StatCard label="RAM" value={status?.memoryMb != null ? `${status.memoryMb} MB` : "-"} />
          <div className="rounded-lg border border-emerald-500/20 bg-panel-950/80 p-4 shadow-glow backdrop-blur md:col-span-2 xl:col-span-5">
            <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">Uptime</p>
            <p className="mt-2 text-sm text-zinc-300">{status?.uptime || "sem processo java ativo"}</p>
            <p className="mt-4 text-xs uppercase tracking-[0.25em] text-zinc-500">Atalhos</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void loadFile("server.properties")}
                className="rounded border border-zinc-800 bg-black/20 px-3 py-2 text-sm text-zinc-300 hover:border-zinc-700"
              >
                Abrir server.properties
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("files");
                  void openPath("plugins");
                }}
                className="rounded border border-zinc-800 bg-black/20 px-3 py-2 text-sm text-zinc-300 hover:border-zinc-700"
              >
                Abrir pasta plugins
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("plugins");
                  void refreshPlugins();
                }}
                className="rounded border border-zinc-800 bg-black/20 px-3 py-2 text-sm text-zinc-300 hover:border-zinc-700"
              >
                Atualizar plugins
              </button>
              <button
                type="button"
                onClick={() => void deleteCurrentServer()}
                disabled={isDeletingServer}
                className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200 hover:bg-red-500/20 disabled:opacity-50"
              >
                {isDeletingServer ? "Excluindo..." : "Excluir Servidor"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "plugins" ? (
        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <form
            onSubmit={installPlugin}
            className="rounded-lg border border-emerald-500/20 bg-panel-950/80 p-4 shadow-glow backdrop-blur"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-300">Instalar Plugin</p>
            <div className="mt-4 flex gap-2">
              {(["hangar", "modrinth", "url"] as PluginSource[]).map((source) => (
                <button
                  key={source}
                  type="button"
                  onClick={() => setPluginSource(source)}
                  className={`rounded border px-3 py-2 text-sm ${
                    pluginSource === source
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
                      : "border-zinc-800 bg-black/20 text-zinc-400"
                  }`}
                >
                  {source === "url" ? "URL" : source === "modrinth" ? "Modrinth" : "Hangar"}
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-4">
              {pluginSource === "hangar" ? (
                <>
                  <Field label="Autor">
                    <input
                      value={pluginAuthor}
                      onChange={(event) => setPluginAuthor(event.target.value)}
                      className={inputClass}
                      placeholder="EssentialsX"
                    />
                  </Field>
                  <Field label="Projeto">
                    <input
                      value={pluginProject}
                      onChange={(event) => setPluginProject(event.target.value)}
                      className={inputClass}
                      placeholder="Essentials"
                    />
                  </Field>
                  <Field label="Versao">
                    <input
                      value={pluginVersion}
                      onChange={(event) => setPluginVersion(event.target.value)}
                      className={inputClass}
                      placeholder="vazio = mais recente"
                    />
                  </Field>
                </>
              ) : null}

              {pluginSource === "modrinth" ? (
                <Field label="Projeto Modrinth">
                  <input
                    value={pluginProjectId}
                    onChange={(event) => setPluginProjectId(event.target.value)}
                    className={inputClass}
                    placeholder="luckperms"
                  />
                </Field>
              ) : null}

              {pluginSource === "url" ? (
                <>
                  <Field label="URL">
                    <input
                      value={pluginUrl}
                      onChange={(event) => setPluginUrl(event.target.value)}
                      className={inputClass}
                      placeholder="https://..."
                    />
                  </Field>
                  <Field label="Nome do arquivo">
                    <input
                      value={pluginFilename}
                      onChange={(event) => setPluginFilename(event.target.value)}
                      className={inputClass}
                      placeholder="plugin.jar"
                    />
                  </Field>
                </>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={pluginBusy}
              className="mt-4 w-full rounded border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {pluginBusy ? "Baixando..." : "Instalar Plugin"}
            </button>
          </form>

          <div className="rounded-lg border border-emerald-500/20 bg-panel-950/80 p-4 shadow-glow backdrop-blur">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-300">Plugins Instalados</p>
              <button
                type="button"
                onClick={() => void refreshPlugins()}
                className="rounded border border-zinc-800 bg-black/20 px-3 py-2 text-sm text-zinc-300 hover:border-zinc-700"
              >
                Atualizar
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {plugins.length === 0 ? (
                <div className="rounded border border-dashed border-zinc-800 bg-black/20 p-4 text-sm text-zinc-500">
                  Nenhum plugin em `plugins/`.
                </div>
              ) : null}
              {plugins.map((plugin) => (
                <div key={plugin.path} className="rounded border border-zinc-800 bg-black/20 p-3">
                  <p className="text-sm font-semibold text-zinc-100">{plugin.name}</p>
                  <p className="mt-1 text-xs text-zinc-500">{plugin.path}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "files" ? (
        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="rounded-lg border border-emerald-500/20 bg-panel-950/80 p-4 shadow-glow backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-300">Arquivos</p>
                <p className="text-xs text-zinc-500">/{browserPath || "."}</p>
              </div>
              <button
                type="button"
                onClick={() => void openPath(parentPath)}
                className="rounded border border-zinc-800 bg-black/20 px-3 py-2 text-sm text-zinc-300 hover:border-zinc-700"
              >
                Voltar
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {fileEntries.map((entry) => (
                <button
                  key={entry.path}
                  type="button"
                  onClick={() => {
                    if (entry.type === "directory") {
                      void openPath(entry.path);
                      return;
                    }
                    void loadFile(entry.path);
                  }}
                  className="flex w-full items-center justify-between rounded border border-zinc-800 bg-black/20 px-3 py-3 text-left hover:border-zinc-700"
                >
                  <span className="text-sm text-zinc-200">{entry.name}</span>
                  <span className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                    {entry.type === "directory" ? "dir" : "file"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-emerald-500/20 bg-panel-950/80 p-4 shadow-glow backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-300">Editor</p>
                <p className="text-xs text-zinc-500">{selectedFilePath}</p>
              </div>
              <button
                type="button"
                onClick={() => void saveSelectedFile()}
                disabled={editorBusy}
                className="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
              >
                {editorBusy ? "Salvando..." : "Salvar"}
              </button>
            </div>

            <textarea
              value={selectedFileContent}
              onChange={(event) => setSelectedFileContent(event.target.value)}
              className="mt-4 h-[520px] w-full rounded border border-zinc-800 bg-black px-4 py-4 font-mono text-sm leading-6 text-zinc-200 outline-none focus:border-emerald-500/40"
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
    <div className="rounded-lg border border-emerald-500/20 bg-panel-950/80 p-4 shadow-glow backdrop-blur">
      <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">{label}</p>
      <p className={`mt-2 text-xl font-semibold ${accent ? "text-emerald-300" : "text-zinc-100"}`}>{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs uppercase tracking-[0.25em] text-zinc-500">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded border border-zinc-800 bg-black/20 px-3 py-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-500/40";
