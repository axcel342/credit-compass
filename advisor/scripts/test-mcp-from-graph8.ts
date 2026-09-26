import { g8Caller } from "../src/lib/g8/client";
import { OPS } from "../src/lib/g8/ops";
const serverId = process.argv[2]; // mcp_server_id printed by register-mcp.ts
const t = "trigger-roi00001", n = "tool-roi00001";
const config = { metadata: {}, settings: {}, start_node_id: t, nodes: [
  { node_id: t, node_type: "trigger", name: "Test", position: { x: 0, y: 0 }, connections: [n], config: { trigger_type: "tool_call", input_schema: { fields: [] } } },
  { node_id: n, node_type: "tool", name: "Ping ROI Advisor", position: { x: 0, y: 150 }, connections: [],
    config: { tool: "mcp", mcp_server_id: serverId, mcp_tool_name: "ping", tool_config: { arguments: { note: "from graph8" } } } } ],
  edges: [{ id: `edge-${t}-${n}`, source: t, target: n }] };
console.log("validate:", JSON.stringify(await g8Caller.callRaw(OPS.validateWorkflow, { body: { config } })));
const wf = await g8Caller.callRaw<{ action_id: string }>(OPS.createWorkflow, { body: { name: "[sim] ROI Advisor MCP test", config, enabled: true } });
const ex = await g8Caller.callRaw<{ execution_id: string }>(OPS.executeWorkflow, { path: { action_id: wf.action_id }, body: { input_data: {} } });
await new Promise((r) => setTimeout(r, 15000));
console.log(JSON.stringify(await g8Caller.callRaw(OPS.getExecution, { path: { execution_id: ex.execution_id } })).slice(0, 1500));
