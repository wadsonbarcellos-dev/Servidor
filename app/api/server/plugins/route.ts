import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { MC_USER_AGENT } from "@/lib/minecraft";
import { resolveServerPath } from "@/lib/server-fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PluginSource = "url" | "modrinth" | "hangar";

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

async function downloadFile(url: string, destination: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": MC_USER_AGENT,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Falha ao baixar plugin (${response.status}).`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  await fs.writeFile(destination, bytes);
}

async function resolveModrinthPlugin(projectIdOrSlug: string, gameVersion: string, loader: string) {
  const query = new URL(`https://api.modrinth.com/v2/project/${projectIdOrSlug}/version`);
  query.searchParams.set("loaders", JSON.stringify([loader]));
  query.searchParams.set("game_versions", JSON.stringify([gameVersion]));

  const versions = await fetchJson<
    Array<{
      name: string;
      version_number: string;
      files: Array<{ url: string; filename: string; primary: boolean }>;
    }>
  >(query.toString());

  const selected = versions[0];
  const primaryFile = selected?.files.find((file) => file.primary) ?? selected?.files[0];

  if (!selected || !primaryFile) {
    throw new Error(`Nenhuma versao Modrinth encontrada para ${projectIdOrSlug} em ${gameVersion}/${loader}.`);
  }

  return {
    name: selected.name,
    version: selected.version_number,
    filename: primaryFile.filename,
    url: primaryFile.url,
  };
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": MC_USER_AGENT,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Falha ao consultar ${url} (${response.status}).`);
  }

  return response.text();
}

async function resolveHangarPlugin(author: string, project: string, version?: string) {
  let targetVersion = version?.trim();

  if (!targetVersion) {
    const versionsHtml = await fetchText(`https://hangar.papermc.io/${author}/${project}/versions`);
    const versionMatch = versionsHtml.match(new RegExp(`/${author}/${project}/versions/([^"?#/]+)`));
    targetVersion = versionMatch?.[1];
  }

  if (!targetVersion) {
    throw new Error(`Nao consegui descobrir a versao mais recente de ${author}/${project} no Hangar.`);
  }

  const versionPage = await fetchText(`https://hangar.papermc.io/${author}/${project}/versions/${targetVersion}`);
  const downloadMatch = versionPage.match(
    /https:\/\/hangarcdn\.papermc\.io\/plugins\/[^"'\\s]+\/versions\/[^"'\\s]+\/PAPER\/[^"'\\s]+\.jar/
  );

  if (!downloadMatch) {
    throw new Error(`Nao encontrei um download Paper para ${author}/${project} ${targetVersion} no Hangar.`);
  }

  const url = downloadMatch[0];
  const filename = decodeURIComponent(url.split("/").pop() || `${project}-${targetVersion}.jar`);

  return {
    name: project,
    version: targetVersion,
    filename,
    url,
  };
}

export async function GET(request: NextRequest) {
  try {
    const serverName = request.nextUrl.searchParams.get("serverName")?.trim() || "survival";
    const { absolutePath } = resolveServerPath(serverName, "plugins");
    await fs.mkdir(absolutePath, { recursive: true });
    const entries = await fs.readdir(absolutePath, { withFileTypes: true });

    return NextResponse.json({
      ok: true,
      plugins: entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".jar"))
        .map((entry) => ({
          name: entry.name,
          path: `plugins/${entry.name}`,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao listar plugins.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      serverName?: string;
      source?: PluginSource;
      url?: string;
      projectId?: string;
      author?: string;
      project?: string;
      version?: string;
      gameVersion?: string;
      loader?: string;
      filename?: string;
    };

    const serverName = body.serverName?.trim() || "survival";
    const source = body.source ?? "url";
    const { absolutePath: pluginsDir } = resolveServerPath(serverName, "plugins");
    await fs.mkdir(pluginsDir, { recursive: true });

    if (source === "url") {
      if (!body.url?.trim()) {
        return NextResponse.json({ ok: false, error: "Informe a URL do plugin." }, { status: 400 });
      }

      const fileName = body.filename?.trim() || path.basename(new URL(body.url).pathname) || "plugin.jar";
      const target = path.join(pluginsDir, fileName);
      await downloadFile(body.url, target);

      return NextResponse.json({
        ok: true,
        plugin: { name: fileName, path: `plugins/${fileName}` },
        message: "Plugin baixado com sucesso.",
      });
    }

    if (source === "hangar" && (!body.author?.trim() || !body.project?.trim())) {
      return NextResponse.json({ ok: false, error: "Informe autor e projeto do Hangar." }, { status: 400 });
    }

    if (source !== "hangar" && !body.projectId?.trim()) {
      return NextResponse.json({ ok: false, error: "Informe o slug ou ID do projeto Modrinth." }, { status: 400 });
    }

    const resolved =
      source === "hangar"
        ? await resolveHangarPlugin(body.author?.trim() || "", body.project?.trim() || "", body.version)
        : await resolveModrinthPlugin(
            body.projectId!.trim(),
            body.gameVersion?.trim() || "1.21.11",
            body.loader?.trim() || "paper"
          );

    const target = path.join(pluginsDir, resolved.filename);
    await downloadFile(resolved.url, target);

    return NextResponse.json({
      ok: true,
      plugin: { name: resolved.filename, path: `plugins/${resolved.filename}` },
      message:
        source === "hangar"
          ? `Plugin ${resolved.name} ${resolved.version} instalado via Hangar.`
          : `Plugin ${resolved.name} ${resolved.version} instalado via Modrinth.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao instalar plugin.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
