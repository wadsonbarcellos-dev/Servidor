import { promises as fs } from "fs";
import { NextRequest } from "next/server";
import { getLatestLog } from "@/lib/minecraft";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toSse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function readTail(filePath: string, lines = 50) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return content.split(/\r?\n/).filter(Boolean).slice(-lines);
  } catch {
    return ["Aguardando logs do servidor..."];
  }
}

export async function GET(request: NextRequest) {
  const serverName = request.nextUrl.searchParams.get("serverName")?.trim() || "survival";
  const logPath = getLatestLog(serverName);

  const encoder = new TextEncoder();
  let previousSnapshot = "";
  let interval: NodeJS.Timeout | undefined;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const pushLogs = async () => {
        const lines = await readTail(logPath, 50);
        const snapshot = lines.join("\n");

        if (snapshot === previousSnapshot) return;
        previousSnapshot = snapshot;

        controller.enqueue(encoder.encode(toSse("logs", { lines })));
      };

      controller.enqueue(encoder.encode(toSse("ready", { serverName })));
      await pushLogs();

      interval = setInterval(() => {
        void pushLogs();
      }, 1500);
    },
    cancel() {
      if (interval) clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

