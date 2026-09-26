import asyncio, json, os, glob
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client
def txt(r): return r.content[0].text if r.content else str(r)
async def find(s,f,pages=2,limit=100):
    rows=[]
    for p in range(1,pages+1):
        d=json.loads(txt(await s.call_tool("g8_find_contacts",{"filters":f,"page":p,"limit":limit})))
        rows+=d.get('contacts',[]); 
        if not d.get('has_next'): break
    return rows,d.get('total')
async def main():
    async with streamablehttp_client("https://be.graph8.com/mcp/", headers={"Authorization":"Bearer "+os.environ["G8_API_KEY"]}, timeout=120, sse_read_timeout=300) as (r,w,_):
        async with ClientSession(r,w) as s:
            await s.initialize(); await s.call_tool("g8_current_org",{}); await s.call_tool("g8_tool_search",{"query":"find contacts prospect database"})
            # filter-shape probes
            for label,f in [("sen VP only",[{"field":"seniority_level","operator":"any_of","value":["Vice President"]}]),
                            ("dept Sales",[{"field":"job_department","operator":"any_of","value":["Sales"]}]),
                            ("industry contains Software",[{"field":"company_industry","operator":"contains","value":["Software"]}]),
                            ("industry any_of Computer Software",[{"field":"company_industry","operator":"any_of","value":["Computer Software"]}]),
                            ("emp between 51,500",[{"field":"company_employee_count","operator":"between","value":[51,500]}]),
                            ("emp any_of 51-200",[{"field":"company_employee_count","operator":"any_of","value":["51-200","201-500"]}])]:
                rows,total=await find(s,f,pages=1,limit=5); print(label.ljust(36),'total',total,'rows',len(rows))
            # trace CRM records back to the index by linkedin_url
            crm=[json.load(open(f))['data'] for f in glob.glob('cdet/*.json')]
            urls=[c['linkedin_url'] for c in crm if c.get('linkedin_url')]
            found=[]
            for i in range(0,len(urls),50):
                rows,_=await find(s,[{"field":"linkedin_url","operator":"any_of","value":urls[i:i+50]}],pages=1,limit=100); found+=rows
            json.dump(found,open('gs_trace.json','w')); print('traced',len(found),'of',len(urls))
asyncio.run(main())
