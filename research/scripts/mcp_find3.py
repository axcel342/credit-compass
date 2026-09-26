import asyncio, json, os
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client
def txt(r): return r.content[0].text if r.content else str(r)
C={"sales_vps_midmarket":[{"field":"seniority_level","operator":"any_of","value":["Vice President"]},{"field":"job_department","operator":"any_of","value":["Sales"]},{"field":"company_employee_count","operator":"any_of","value":["51-200","201-500"]}]}
async def main():
    async with streamablehttp_client("https://be.graph8.com/mcp/", headers={"Authorization":"Bearer "+os.environ["G8_API_KEY"]}, timeout=120, sse_read_timeout=300) as (r,w,_):
        async with ClientSession(r,w) as s:
            await s.initialize(); await s.call_tool("g8_current_org",{}); await s.call_tool("g8_tool_search",{"query":"find contacts prospect database"})
            for n,f in C.items():
                rows=[]
                for p in (1,2):
                    d=json.loads(txt(await s.call_tool("g8_find_contacts",{"filters":f,"page":p,"limit":100}))); rows+=d.get('contacts',[])
                json.dump(rows,open(f'gs_{n}.json','w')); print(n,'total',d.get('total'),'pulled',len(rows))
asyncio.run(main())
