import path from "path";
import { getServerDir } from "@/lib/minecraft";

export function resolveServerPath(serverName: string, relativePath = "") {
  const serverDir = getServerDir(serverName);
  const sanitized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const absolutePath = path.resolve(serverDir, sanitized);
  const relativeToServer = path.relative(serverDir, absolutePath);

  if (relativeToServer.startsWith("..") || path.isAbsolute(relativeToServer)) {
    throw new Error("Caminho fora do diretorio do servidor.");
  }

  return { serverDir, absolutePath, relativePath: sanitized };
}
