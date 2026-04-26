import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import {
  getServerDir,
  getServerJar,
  getServerMetadataPath,
  MC_SERVER_ROOT,
  MC_USER_AGENT,
  ServerMetadata,
  ServerSoftware,
} from "@/lib/minecraft";
import { runBash, shellQuote } from "@/lib/shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function fetchJson<T>(url: string) {
  const response = await fetch(url, { headers: { "User-Agent": MC_USER_AGENT } });
  if (!response.ok) throw new Error(`Falha ao consultar ${url}`);
  return (await response.json()) as T;
}

async function downloadJar(url: string, dest: string) {
  const cmd = `curl -L -A ${shellQuote(MC_USER_AGENT)} ${shellQuote(url)} -o ${shellQuote(dest)}`;
  const result = await runBash(cmd);
  if (result.code !== 0) throw new Error("Falha no download.");
}

async function installBedrock(serverDir: string) {
  const url = "https://www.minecraft.net/bedrockdedicatedserver/bin-linux/bedrock-server-1.21.60.10.zip";
  const zip = path.join(serverDir, "bedrock.zip");
  await downloadJar(url, zip);
  await runBash(`unzip -o ${shellQuote(zip)} -d ${shellQuote(serverDir)} && rm ${shellQuote(zip)} && chmod +x ${shellQuote(path.join(serverDir, "bedrock_server"))}`);
  return { software: "bedrock" as ServerSoftware, version: "1.21.60.10", jarUrl: url };
}

async function installFabric(serverJar: string, version: string) {
  const url = `https://meta.fabricmc.net/v2/versions/loader/${version}/0.16.10/1.0.1/server/jar`;
  await downloadJar(url, serverJar);
  return { software: "fabric" as ServerSoftware, version, build: "0.16.10", jarUrl: url };
}

export async function GET() {
  try {
    await fs.mkdir(MC_SERVER_ROOT, { recursive: true });
    const entries = await fs.readdir(MC_SERVER_ROOT, { withFileTypes: true });
    const servers = await Promise.all(entries.filter(e => e.isDirectory()).map(async e => {
      const metadata = await fs.readFile(getServerMetadataPath(e.name), "utf8").then(JSON.parse).catch(() => ({}));
      return {
        name: e.name,
        installed: await fs.access(getServerJar(e.name, metadata.software)).then(() => true).catch(() => false),
        ...metadata
      };
    }));
    return NextResponse.json({ ok: true, servers });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Erro ao listar servidores." });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { serverName, software = "paper", version = "latest" } = body;
    if (!serverName) return NextResponse.json({ ok: false, error: "Nome do servidor é obrigatório." });

    const safeName = serverName.replace(/[^a-zA-Z0-9_-]/g, "-");
    const serverDir = getServerDir(safeName);
    const serverJar = getServerJar(safeName, software);

    await fs.mkdir(serverDir, { recursive: true });
    let resolved;

    if (software === "bedrock") {
      resolved = await installBedrock(serverDir);
    } else if (software === "fabric") {
      resolved = await installFabric(serverJar, version === "latest" ? "1.21.1" : version);
    } else {
      // Simplificado para Paper por padrão se não for Bedrock/Fabric
      const paperUrl = `https://api.papermc.io/v2/projects/paper/versions/1.21.1/builds/131/downloads/paper-1.21.1-131.jar`;
      await downloadJar(paperUrl, serverJar);
      resolved = { software: "paper" as ServerSoftware, version: "1.21.1", jarUrl: paperUrl };
    }

    const metadata: ServerMetadata = { ...resolved, name: safeName, installedAt: new Date().toISOString() };
    await fs.writeFile(getServerMetadataPath(safeName), JSON.stringify(metadata, null, 2));
    await fs.writeFile(path.join(serverDir, "eula.txt"), "eula=true\n");

    return NextResponse.json({ ok: true, message: "Servidor instalado!", server: metadata });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
