import path from "path";

export const MC_SERVER_ROOT = process.env.MC_SERVER_ROOT || path.join(process.cwd(), "server");
export const MC_USER_AGENT =
  process.env.MC_USER_AGENT || "minecraft-control-panel/0.1.0 (https://github.com/codespaces)";

export type ServerSoftware = "vanilla" | "paper" | "purpur" | "spigot" | "custom";

export type ServerMetadata = {
  name: string;
  software: ServerSoftware;
  version: string;
  build?: string;
  jarUrl?: string;
  installedAt: string;
};

export function getServerDir(serverName: string) {
  return path.join(MC_SERVER_ROOT, serverName);
}

export function getServerJar(serverName: string) {
  return path.join(getServerDir(serverName), "server.jar");
}

export function getLatestLog(serverName: string) {
  return path.join(getServerDir(serverName), "logs", "latest.log");
}

export function getSessionName(serverName: string) {
  const safeName = serverName.replace(/[^a-zA-Z0-9_-]/g, "-");
  return `mc-${safeName}`;
}

export function getServerMetadataPath(serverName: string) {
  return path.join(getServerDir(serverName), "server.json");
}
