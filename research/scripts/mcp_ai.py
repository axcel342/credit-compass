import asyncio, json, os, sys
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client
from guard import check, balance
def txt(r): return r.content[0].text if r.content else str(r)
async def main():
    ids=json.loads(sys.argv[1]); out=sys.argv[2]; args=json.loads(sys.argv[3]); est=float(sys.argv[4])
    async with streamablehttp_client("https://be.graph8.com/mcp/", headers={"Authorization":"Bearer "+os.environ["G8_API_KEY"]}, timeout=600, sse_read_timeout=900) as (r,w,_):
        async with ClientSession(r,w) as s:
            await s.initialize(); await s.call_tool("g8_current_org",{}); await s.call_tool("g8_tool_search",{"query":"enrich contacts waterfall ai research"})
            a={"contact_ids":ids,"list_id":2,**args}
            print("DRY:",txt(await s.call_tool("g8_enrich_contacts",{**a,"dry_run":True}))[:700])
            check(est)
            res=txt(await s.call_tool("g8_enrich_contacts",{**a,"dry_run":False})); open(out,'w').write(res); print("RUN:",res[:3000])
    print('balance',balance())
asyncio.run(main())
