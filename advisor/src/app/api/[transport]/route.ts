import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { authorizeMcp } from "@/lib/mcp/auth";
import { registerTools } from "@/lib/mcp/tools";
import { loadDashboardData } from "@/lib/dashboard/data";

export const runtime = "nodejs";
export const maxDuration = 60;

const handler = createMcpHandler(
  (server) => {
    server.registerTool("ping", { title: "Ping", description: "Check the ROI Advisor MCP server is reachable.", inputSchema: { note: z.string().optional() } },
      async ({ note }) => ({ content: [{ type: "text", text: `ROI Advisor is up${note ? `: ${note}` : ""}` }] }));
    registerTools(server as unknown as Parameters<typeof registerTools>[0], () => loadDashboardData());
  },
  { serverInfo: { name: "graph8-roi-advisor", version: "0.1.0" } },
  { basePath: "/api", maxDuration: 60, verboseLogs: false },
);

async function guarded(req: Request): Promise<Response> {
  const token = process.env.MCP_TOKEN;
  if (!token || !authorizeMcp(req, token)) return new Response("unauthorized", { status: 401 });
  return handler(req);
}

export { guarded as GET, guarded as POST, guarded as DELETE };
