import asyncio, json, os, sys
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client
from guard import check, balance
def txt(r): return r.content[0].text if r.content else str(r)
async def main():
    emails=json.loads(sys.argv[1]); per=float(sys.argv[2]); out=sys.argv[3]
    res={}
    async with streamablehttp_client("https://be.graph8.com/mcp/", headers={"Authorization":"Bearer "+os.environ["G8_API_KEY"]}, timeout=120, sse_read_timeout=300) as (r,w,_):
        async with ClientSession(r,w) as s:
            await s.initialize(); await s.call_tool("g8_current_org",{}); await s.call_tool("g8_tool_search",{"query":"verify email enrichment"})
            for e in emails:
                b,spent=check(per)
                res[e]=txt(await s.call_tool("g8_enrichment_verify_email",{"body":{"email":e},"confirm":True}))
                print(e,'| before',b,'|',res[e][:300])
    json.dump(res,open(out,'w'),indent=1); print('balance now',balance())
asyncio.run(main())
