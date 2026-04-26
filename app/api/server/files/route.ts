import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { resolveServerPath } from "@/lib/server-fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readDirectory(absolutePath: string, relativePath: string) {
  const entries = await fs.readdir(absolutePath, { withFileTypes: true });

  return {
    type: "directory",
    path: relativePath,
    entries: entries
      .map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? "directory" : "file",
        path: [relativePath, entry.name].filter(Boolean).join("/"),
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
  };
}

export async function GET(request: NextRequest) {
  try {
    const serverName = request.nextUrl.searchParams.get("serverName")?.trim() || "survival";
    const relativePath = request.nextUrl.searchParams.get("path")?.trim() || "";
    const { absolutePath, relativePath: normalizedPath } = resolveServerPath(serverName, relativePath);
    const stats = await fs.stat(absolutePath);

    if (stats.isDirectory()) {
      return NextResponse.json({ ok: true, ...(await readDirectory(absolutePath, normalizedPath)) });
    }

    const content = await fs.readFile(absolutePath, "utf8");
    return NextResponse.json({
      ok: true,
      type: "file",
      path: normalizedPath,
      name: path.basename(absolutePath),
      content,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao ler arquivo do servidor.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { serverName?: string; path?: string; content?: string };
    const serverName = body.serverName?.trim() || "survival";
    const relativePath = body.path?.trim();

    if (!relativePath) {
      return NextResponse.json({ ok: false, error: "Informe o caminho do arquivo." }, { status: 400 });
    }

    const { absolutePath, relativePath: normalizedPath } = resolveServerPath(serverName, relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, body.content ?? "", "utf8");

    return NextResponse.json({ ok: true, path: normalizedPath, message: "Arquivo salvo com sucesso." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao salvar arquivo do servidor.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

