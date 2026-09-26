# Spend guard: START balance recorded in budget_start.txt; hard cap 500 credits.
import json, subprocess, os
CAP=500
def balance():
    out=subprocess.run(['curl','-s','https://be.graph8.com/api/v1/usage','-H','Authorization: Bearer '+os.environ['G8_API_KEY']],capture_output=True,text=True).stdout
    return json.loads(out)['data']['available_credits']
def check(next_cost):
    start=float(open('budget_start.txt').read()); b=balance(); spent=start-b
    if spent+next_cost>CAP: raise SystemExit(f'SPEND GUARD: spent {spent}, next {next_cost} would exceed {CAP}')
    return b, spent
