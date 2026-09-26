#!/bin/bash
# usage: jc_run.sh '<json array of row ids>' <outfile>
B=https://be.graph8.com/api/v1; H="Authorization: Bearer $G8_API_KEY"
COL=$(python3 -c "import json; print(json.load(open('jc_cfg_resp.json'))['data']['column_id'])")
curl -s -X POST "$B/enrichment/waterfall/enrich" -H "$H" -H 'Content-Type: application/json' -d "{\"column_id\":\"$COL\",\"list_id\":2,\"record_ids\":$1,\"skip_existing_values\":false}" > "$2.start"
JOB=$(python3 -c "import json; print(json.load(open('$2.start'))['data']['job_id'])")
for i in $(seq 1 36); do P=$(curl -s "$B/enrichment/waterfall/jobs/$JOB/progress" -H "$H"); st=$(echo "$P" | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['status'])"); [ "$st" != running ] && [ "$st" != queued ] && break; sleep 5; done
echo "$P" > "$2"; echo "$P" | head -c 600; echo
curl -s "$B/enrichment/jobs/$JOB" -H "$H" > "$2.job"; head -c 2500 "$2.job"; echo
