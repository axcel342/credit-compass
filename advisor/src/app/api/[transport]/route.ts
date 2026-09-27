import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { resolveMcpCaller } from "@/lib/mcp/auth";
import { mcpWorkspace } from "@/lib/mcp/context";
import { registerTools } from "@/lib/mcp/tools";
import { loadDashboardData } from "@/lib/dashboard/data";
import { workspaceStore } from "@/lib/workspace/store";

export const runtime = "nodejs";
export const maxDuration = 60;

const handler = createMcpHandler(
  (server) => {
    server.registerTool("ping", { title: "Ping", description: "Check the ROI Advisor MCP server is reachable.", inputSchema: { note: z.string().optional() } },
      async ({ note }) => ({ content: [{ type: "text", text: `ROI Advisor is up${note ? `: ${note}` : ""}` }] }));
    registerTools(server as unknown as Parameters<typeof registerTools>[0], () => loadDashboardData(mcpWorkspace.getStore()));
  },
  { serverInfo: { name: "graph8-roi-advisor", version: "0.1.0" } },
  { basePath: "/api", maxDuration: 60, verboseLogs: false, redisUrl: process.env.REDIS_URL ?? process.env.KV_URL },
);

async function guarded(req: Request): Promise<Response> {
  if (new URL(req.url).pathname.endsWith("/message")) return handler(req); // SSE message posts carry the session id, as before
  const c = await resolveMcpCaller(req, workspaceStore());
  if (!c) return new Response("unauthorized", { status: 401 });
  return mcpWorkspace.run(c, () => handler(req));
}

export { guarded as GET, guarded as POST, guarded as DELETE };
