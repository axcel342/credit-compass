import asyncio, json, os, re, uuid
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client
def txt(r): return r.content[0].text if r.content else str(r)
async def main():
    hdr={"Authorization":"Bearer "+os.environ["G8_API_KEY"]}
    sysp=[x for x in json.load(open('skills.json'))['actions'] if x['name']=='Buying Signals Scan'][0]['prompt_template']
    prompt=sysp+"\n\nAttached context — web search results (title, url, content):\n{search_results}"
    async with streamablehttp_client("https://be.graph8.com/mcp/", headers=hdr, timeout=60, sse_read_timeout=300) as (r,w,_):
        async with ClientSession(r,w) as s:
            await s.initialize(); await s.call_tool("g8_current_org",{})
            for q in ("create llm skill","create workflow","validate workflow","execute workflow"): await s.call_tool("g8_tool_search",{"query":q})
            res=txt(await s.call_tool("g8_skill_create_llm",{"name":"[audit-probe] Buying Signals Scan (grounded)","model":"gpt-4o","prompt_template":prompt,
                 "category":"Analysis","object_type":"Company","temperature":0.3,"max_tokens":2000,"dry_run":False}))
            print("SKILL_CREATE:",res[:300]); sid=re.search(r'"action_id"\s*:\s*"([0-9a-f-]{36})"',res).group(1)
            h=lambda: uuid.uuid4().hex[:8]
            t,ws,sk=f"trigger-{h()}",f"web_search-{h()}",f"action-{h()}"
            cfg={"metadata":{},"settings":{},"start_node_id":t,
              "nodes":[
               {"node_id":t,"node_type":"trigger","name":"Research request","position":{"x":0,"y":0},"connections":[ws],
                "config":{"trigger_type":"tool_call","input_schema":{"fields":[{"name":"company_name","type":"string"},{"name":"company_domain","type":"string"}]}}},
               {"node_id":ws,"node_type":"web_search","name":"Web search","position":{"x":0,"y":150},"connections":[sk],
                "config":{"query":"${trigger.company_name} ${trigger.company_domain} funding hiring product launch news 2026","max_results":8}},
               {"node_id":sk,"node_type":"action","name":"Buying Signals Scan (grounded)","position":{"x":0,"y":300},"connections":[],
                "config":{"action_id":sid,"action_name":"[audit-probe] Buying Signals Scan (grounded)","input_mappings":[
                   {"source_expression":"${trigger.company_name}","target_field":"company_name"},
                   {"source_expression":"${"+ws+".results}","target_field":"search_results"}]}}],
              "edges":[{"id":f"edge-{t}-{ws}","source":t,"target":ws},{"id":f"edge-{ws}-{sk}","source":ws,"target":sk}]}
            print("VALIDATE:",txt(await s.call_tool("g8_workflow_validate",{"config":cfg}))[:800])
            res=txt(await s.call_tool("g8_workflow_create",{"name":"[audit-probe] Grounded buying signals","config":cfg,"description":"auditor spike","enabled":True,"dry_run":False}))
            print("WF_CREATE:",res[:400]); wid=re.search(r'"action_id"\s*:\s*"([0-9a-f-]{36})"',res).group(1)
            json.dump({"skill":sid,"workflow":wid,"ws":ws,"sk":sk},open('wf_ids.json','w'))
asyncio.run(main())
