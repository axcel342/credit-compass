import asyncio, json, os
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client
def txt(r): return r.content[0].text if r.content else str(r)
COHORTS={
 "sales_leaders_midmarket_software":[{"field":"seniority_level","operator":"any_of","value":["Vice President","Director"]},{"field":"job_department","operator":"any_of","value":["Sales"]},{"field":"company_industry","operator":"contains","value":["Software"]},{"field":"company_employee_count","operator":"between","value":[51,500]},{"field":"country","operator":"any_of","value":["United States"]}],
 "founders_small_cos":[{"field":"job_title","operator":"contains","value":["founder"]},{"field":"company_employee_count","operator":"between","value":[1,50]},{"field":"country","operator":"any_of","value":["United States"]}],
 "marketing_finserv":[{"field":"job_department","operator":"any_of","value":["Marketing"]},{"field":"seniority_level","operator":"any_of","value":["Vice President","Director"]},{"field":"company_industry","operator":"contains","value":["Financial Services"]},{"field":"company_employee_count","operator":"between","value":[201,1000]}],
}
async def main():
    async with streamablehttp_client("https://be.graph8.com/mcp/", headers={"Authorization":"Bearer "+os.environ["G8_API_KEY"]}, timeout=120, sse_read_timeout=300) as (r,w,_):
        async with ClientSession(r,w) as s:
            await s.initialize(); await s.call_tool("g8_current_org",{})
            await s.call_tool("g8_tool_search",{"query":"find contacts prospect database"})
            for name,f in COHORTS.items():
                rows=[]
                for page in (1,2):
                    t=txt(await s.call_tool("g8_find_contacts",{"filters":f,"page":page,"limit":100}))
                    try: d=json.loads(t)
                    except Exception: print(name,'NONJSON',t[:300]); break
                    items=d if isinstance(d,list) else (d.get('data') or d.get('results') or d.get('contacts') or [])
                    if isinstance(items,dict): items=items.get('items') or items.get('results') or []
                    rows+=items
                    if page==1: print(name,'keys:',list(d.keys()) if isinstance(d,dict) else 'list', '| sample:', json.dumps(items[0])[:700] if items else t[:300])
                json.dump(rows,open(f'gs_{name}.json','w')); print(name,'rows',len(rows))
asyncio.run(main())
