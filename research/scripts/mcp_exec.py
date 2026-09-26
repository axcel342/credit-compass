import asyncio, json, os, re, sys
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client
def txt(r): return r.content[0].text if r.content else str(r)
async def main():
    ids=json.load(open('wf_ids.json')); company,domain,out=sys.argv[1],sys.argv[2],sys.argv[3]
    async with streamablehttp_client("https://be.graph8.com/mcp/", headers={"Authorization":"Bearer "+os.environ["G8_API_KEY"]}, timeout=60, sse_read_timeout=300) as (r,w,_):
        async with ClientSession(r,w) as s:
            await s.initialize(); await s.call_tool("g8_current_org",{})
            for q in ("execute workflow","get workflow execution"): await s.call_tool("g8_tool_search",{"query":q})
            res=txt(await s.call_tool("g8_workflow_execute",{"action_id":ids["workflow"],"input_data":{"company_name":company,"company_domain":domain},"dry_run":False}))
            print("EXEC:",res[:300]); eid=re.search(r'"execution_id"\s*:\s*"([0-9a-f-]{36})"',res).group(1)
            for i in range(60):
                ex=json.loads(txt(await s.call_tool("g8_workflow_get_execution",{"execution_id":eid})))
                if ex.get("status") not in ("pending","running","queued"): break
                await asyncio.sleep(5)
            json.dump(ex,open(out,'w'),indent=1); print("STATUS:",ex.get("status"),ex.get("error_message"))
asyncio.run(main())
