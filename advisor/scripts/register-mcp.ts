import { g8Caller } from "../src/lib/g8/client";
import { OPS } from "../src/lib/g8/ops";

const base = process.env.ADVISOR_URL, token = process.env.MCP_TOKEN;
if (!base || !token) throw new Error("Set ADVISOR_URL and MCP_TOKEN in .env.local");
const res = await g8Caller.call<{ id: number; mcp_server_id: string }>(OPS.createMcpServer, { body: {
  name: "ROI Advisor", description: "Credit ROI answers: cost per outcome, findings, pre-spend estimates",
  transport_type: "sse", connection_url: `${base}/api/sse?key=${encodeURIComponent(token)}`, enabled: true } });
console.log(JSON.stringify({ id: res.id, mcp_server_id: res.mcp_server_id }));
const list = await g8Caller.callRaw<{ servers: { mcp_server_id: string; name: string }[] }>(OPS.listMcpServers);
console.log("visible to workflows:", list.servers.some((s) => s.mcp_server_id === res.mcp_server_id));
