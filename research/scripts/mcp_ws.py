import asyncio, json, os, re, uuid
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client
def txt(r): return r.content[0].text if r.content else str(r)
async def main():
    async with streamablehttp_client("https://be.graph8.com/mcp/", headers={"Authorization":"Bearer "+os.environ["G8_API_KEY"]}, timeout=60, sse_read_timeout=300) as (r,w,_):
        async with ClientSession(r,w) as s:
            await s.initialize(); await s.call_tool("g8_current_org",{})
            for q in ("create workflow","execute workflow","get workflow execution"): await s.call_tool("g8_tool_search",{"query":q})
            t,a,b=f"trigger-{uuid.uuid4().hex[:8]}",f"web_search-{uuid.uuid4().hex[:8]}",f"web_search-{uuid.uuid4().hex[:8]}"
            cfg={"metadata":{},"settings":{},"start_node_id":t,"nodes":[
              {"node_id":t,"node_type":"trigger","name":"t","position":{"x":0,"y":0},"connections":[a],"config":{"trigger_type":"tool_call","input_schema":{"fields":[{"name":"q","type":"string"}]}}},
              {"node_id":a,"node_type":"web_search","name":"literal","position":{"x":0,"y":150},"connections":[b],"config":{"query":"ShipHawk","max_results":5}},
              {"node_id":b,"node_type":"web_search","name":"input","position":{"x":0,"y":300},"connections":[],"config":{"query":"${trigger.q}","max_results":5}}],
              "edges":[{"id":f"edge-{t}-{a}","source":t,"target":a},{"id":f"edge-{a}-{b}","source":a,"target":b}]}
            wid=re.search(r'"action_id"\s*:\s*"([0-9a-f-]{36})"',txt(await s.call_tool("g8_workflow_create",{"name":"[audit-probe] web_search check","config":cfg,"enabled":True,"dry_run":False}))).group(1)
            eid=re.search(r'"execution_id"\s*:\s*"([0-9a-f-]{36})"',txt(await s.call_tool("g8_workflow_execute",{"action_id":wid,"input_data":{"q":"ShipHawk Series B funding"},"dry_run":False}))).group(1)
            for i in range(40):
                ex=json.loads(txt(await s.call_tool("g8_workflow_get_execution",{"execution_id":eid})))
                if ex.get("status") not in ("pending","running","queued"): break
                await asyncio.sleep(4)
            print("WF",wid,ex.get("status"))
            for k,v in (ex.get("output_data") or {}).get("node_results",{}).items():
                o=v.get("output",v) or {}
                if k.startswith("web_search"): print(k,"| query:",o.get("query"),"| count:",o.get("result_count"),"| error:",o.get("error"), "| raw:", json.dumps(v)[:300])
asyncio.run(main())
