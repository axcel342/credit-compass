import asyncio, json, os, sys
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client
async def main():
    hdr={"Authorization":"Bearer "+os.environ["G8_API_KEY"]}
    async with streamablehttp_client("https://be.graph8.com/mcp/", headers=hdr, timeout=60, sse_read_timeout=300) as (r,w,_):
        async with ClientSession(r,w) as s:
            await s.initialize()
            org=await s.call_tool("g8_current_org",{})
            print("ORG:", org.content[0].text[:300])
            for name,args in json.loads(sys.argv[1]):
                res=await s.call_tool(name,args)
                print("=====",name, json.dumps(args)[:200]); print(res.content[0].text[:3000] if res.content else res)
asyncio.run(main())
