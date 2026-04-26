import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";
import { NextRequest, NextResponse } from "next/server";
import {
  getLatestLog,
  getServerDir,
  getServerJar,
  getServerMetadataPath,
  MC_SERVER_ROOT,
  MC_USER_AGENT,
  ServerMetadata,
  ServerSoftware,
} from "@/lib/minecraft";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ServerEntry = {
  name: string;
  path: string;
  installed: boolean;
  hasLogs: boolean;
  software?: ServerSoftware;
  version?: string;
  build?: string;
};

type InstallRequest = {
  serverName?: string;
  software?: ServerSoftware;
  version?: string;
  build?: string;
  jarUrl?: string;
};

function runBash(command: string, cwd?: string) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn("bash", ["-lc", command], {
      cwd,
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

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

async function readMetadata(serverName: string): Promise<ServerMetadata | null> {
  try {
    const content = await fs.readFile(getServerMetadataPath(serverName), "utf8");
    return JSON.parse(content) as ServerMetadata;
  } catch {
    return null;
  }
}

async function listServers(): Promise<ServerEntry[]> {
  await fs.mkdir(MC_SERVER_ROOT, { recursive: true });
  const entries = await fs.readdir(MC_SERVER_ROOT, { withFileTypes: true });

  const servers = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const serverDir = getServerDir(entry.name);
        const serverJar = getServerJar(entry.name);
        const latestLog = getLatestLog(entry.name);
        const metadata = await readMetadata(entry.name);

        const [jarExists, logExists] = await Promise.all([
          fs.access(serverJar).then(() => true).catch(() => false),
          fs.access(latestLog).then(() => true).catch(() => false),
        ]);

        return {
          name: entry.name,
          path: serverDir,
          installed: jarExists,
          hasLogs: logExists,
          software: metadata?.software,
          version: metadata?.version,
          build: metadata?.build,
        };
      })
  );

  return servers.sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": MC_USER_AGENT,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Falha ao consultar ${url} (${response.status}).`);
  }

  return (await response.json()) as T;
}

async function resolveVanillaDownloadUrl(version: string) {
  const manifest = await fetchJson<{
    latest: { release: string };
    versions: Array<{ id: string; url: string; type: string }>;
  }>("https://launchermeta.mojang.com/mc/game/version_manifest_v2.json");

  const targetVersion = version === "latest" ? manifest.latest.release : version;
  const match = manifest.versions.find((entry) => entry.id === targetVersion);

  if (!match) {
    throw new Error(`Versao vanilla ${targetVersion} nao encontrada.`);
  }

  const details = await fetchJson<{
    downloads?: {
      server?: {
        url: string;
      };
    };
  }>(match.url);

  const jarUrl = details.downloads?.server?.url;

  if (!jarUrl) {
    throw new Error(`A versao vanilla ${targetVersion} nao possui download de server.jar.`);
  }

  return { version: targetVersion, build: undefined, jarUrl };
}

async function resolvePaperDownloadUrl(project: "paper" | "folia", version: string) {
  const projectInfo = await fetchJson<{
    versions: Record<string, string[]>;
  }>(`https://fill.papermc.io/v3/projects/${project}`);

  const allVersions = Object.values(projectInfo.versions)
    .flat()
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" }));

  if (allVersions.length === 0) {
    throw new Error(`Nenhuma versao disponivel para ${project}.`);
  }

  async function getBuildForVersion(targetVersion: string) {
    const builds = await fetchJson<
    Array<{
      id: number;
      channel: string;
      downloads?: {
        "server:default"?: {
          url: string;
        };
      };
    }>
    >(`https://fill.papermc.io/v3/projects/${project}/versions/${targetVersion}/builds`);

    const stableBuild = builds.find((entry) => entry.channel === "STABLE");
    const selectedBuild = stableBuild ?? builds[0];
    const jarUrl = selectedBuild?.downloads?.["server:default"]?.url;

    if (!selectedBuild || !jarUrl) {
      return null;
    }

    return { version: targetVersion, build: String(selectedBuild.id), jarUrl };
  }

  if (version !== "latest") {
    const explicit = await getBuildForVersion(version);
    if (!explicit) {
      throw new Error(`Nenhum build disponivel para ${project} ${version}.`);
    }
    return explicit;
  }

  for (const candidate of allVersions) {
    const resolved = await getBuildForVersion(candidate);
    if (resolved) {
      return resolved;
    }
  }

  throw new Error(`Nenhum build estavel disponivel para ${project}.`);
}

async function resolvePurpurDownloadUrl(version: string) {
  const targetVersion =
    version === "latest"
      ? (
          await fetchJson<{
            versions: string[];
          }>("https://api.purpurmc.org/v2/purpur")
        ).versions[0]
      : version;

  if (!targetVersion) {
    throw new Error("Nenhuma versao Purpur disponivel.");
  }

  const buildInfo = await fetchJson<{
    builds: {
      latest: number;
    };
  }>(`https://api.purpurmc.org/v2/purpur/${targetVersion}`);

  const build = String(buildInfo.builds.latest);
  const jarUrl = `https://api.purpurmc.org/v2/purpur/${targetVersion}/${build}/download`;

  return { version: targetVersion, build, jarUrl };
}

async function downloadJar(jarUrl: string, destination: string) {
  const downloadCommand = [
    "if command -v curl >/dev/null 2>&1; then",
    `curl -L -H ${shellQuote(`User-Agent: ${MC_USER_AGENT}`)} ${shellQuote(jarUrl)} -o ${shellQuote(destination)}`,
    "elif command -v wget >/dev/null 2>&1; then",
    `wget --header=${shellQuote(`User-Agent: ${MC_USER_AGENT}`)} -O ${shellQuote(destination)} ${shellQuote(jarUrl)}`,
    "else",
    'echo "curl ou wget nao encontrado" >&2',
    "exit 1",
    "fi",
  ].join("\n");

  const result = await runBash(downloadCommand);

  if (result.code !== 0) {
    throw new Error(result.stderr || "Falha ao baixar server.jar.");
  }
}

async function installSpigot(serverDir: string, serverJar: string, version: string) {
  const buildToolsDir = path.join(serverDir, "buildtools");
  await fs.mkdir(buildToolsDir, { recursive: true });

  const buildToolsJar = path.join(buildToolsDir, "BuildTools.jar");
  const buildCommand = [
    "set -e",
    "if ! command -v git >/dev/null 2>&1; then echo 'git nao encontrado' >&2; exit 1; fi",
    `curl -L ${shellQuote("https://hub.spigotmc.org/jenkins/job/BuildTools/lastSuccessfulBuild/artifact/target/BuildTools.jar")} -o ${shellQuote(buildToolsJar)}`,
    `cd ${shellQuote(buildToolsDir)}`,
    `java -Xmx2G -jar BuildTools.jar --rev ${shellQuote(version)} --output-dir ${shellQuote(buildToolsDir)} --final-name server.jar`,
    `cp ${shellQuote(path.join(buildToolsDir, "server.jar"))} ${shellQuote(serverJar)}`,
  ].join(" && ");

  const result = await runBash(buildCommand, buildToolsDir);

  if (result.code !== 0) {
    throw new Error(result.stderr || result.stdout || "Falha ao compilar Spigot com BuildTools.");
  }

  return { version, build: "buildtools", jarUrl: "https://hub.spigotmc.org/jenkins/job/BuildTools/" };
}

async function resolveInstallSource(body: InstallRequest, serverDir: string, serverJar: string) {
  const software = body.software ?? "paper";
  const requestedVersion = body.version?.trim() || "latest";

  if (software === "custom") {
    if (!body.jarUrl?.trim()) {
      throw new Error("Informe a URL do server.jar para o modo custom.");
    }

    await downloadJar(body.jarUrl.trim(), serverJar);
    return {
      software,
      version: requestedVersion,
      build: body.build?.trim(),
      jarUrl: body.jarUrl.trim(),
      installedBy: "download",
    };
  }

  if (software === "vanilla") {
    const resolved = await resolveVanillaDownloadUrl(requestedVersion);
    await downloadJar(resolved.jarUrl, serverJar);
    return { software, ...resolved, installedBy: "download" };
  }

  if (software === "paper") {
    const resolved = await resolvePaperDownloadUrl("paper", requestedVersion);
    await downloadJar(resolved.jarUrl, serverJar);
    return { software, ...resolved, installedBy: "download" };
  }

  if (software === "purpur") {
    const resolved = await resolvePurpurDownloadUrl(requestedVersion);
    await downloadJar(resolved.jarUrl, serverJar);
    return { software, ...resolved, installedBy: "download" };
  }

  if (software === "spigot") {
    const resolved = await installSpigot(serverDir, serverJar, requestedVersion);
    return { software, ...resolved, installedBy: "buildtools" };
  }

  throw new Error(`Software ${software} nao suportado.`);
}

export async function GET() {
  const servers = await listServers();
  return NextResponse.json({ ok: true, root: MC_SERVER_ROOT, servers });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as InstallRequest;
    const serverName = body.serverName?.trim();

    if (!serverName) {
      return NextResponse.json({ ok: false, error: "Informe serverName." }, { status: 400 });
    }

    const safeName = serverName.replace(/[^a-zA-Z0-9_-]/g, "-");
    const serverDir = getServerDir(safeName);
    const serverJar = getServerJar(safeName);

    await fs.mkdir(serverDir, { recursive: true });
    await fs.mkdir(path.join(serverDir, "logs"), { recursive: true });

    const resolved = await resolveInstallSource(body, serverDir, serverJar);

    await fs.writeFile(path.join(serverDir, "eula.txt"), "eula=true\n", "utf8");

    const metadata: ServerMetadata = {
      name: safeName,
      software: resolved.software,
      version: resolved.version,
      build: resolved.build,
      jarUrl: resolved.jarUrl,
      installedAt: new Date().toISOString(),
    };

    await fs.writeFile(getServerMetadataPath(safeName), JSON.stringify(metadata, null, 2), "utf8");

    return NextResponse.json({
      ok: true,
      message:
        resolved.software === "spigot"
          ? `Servidor ${safeName} compilado com Spigot BuildTools em ${serverDir}.`
          : `Servidor ${safeName} instalado com ${resolved.software} ${resolved.version} em ${serverDir}.`,
      server: {
        name: safeName,
        path: serverDir,
        installed: true,
        hasLogs: false,
        software: resolved.software,
        version: resolved.version,
        build: resolved.build,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado ao instalar o servidor.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
