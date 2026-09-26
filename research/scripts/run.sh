#!/bin/bash
# usage: run.sh <action_id> <input_json> <outfile>
B=https://be.graph8.com/api/v1; H="Authorization: Bearer $G8_API_KEY"
R=$(curl -s -X POST "$B/skills/$1/execute" -H "$H" -H 'Content-Type: application/json' -d "{\"input_data\":$2}")
E=$(echo "$R" | python3 -c "import json,sys; print(json.load(sys.stdin).get('execution_id',''))")
[ -z "$E" ] && { echo "START FAILED: $R"; exit 1; }
for i in $(seq 1 60); do S=$(curl -s "$B/workflows/executions/$E" -H "$H"); st=$(echo "$S" | python3 -c "import json,sys; print(json.load(sys.stdin)['status'])"); [ "$st" != pending ] && [ "$st" != running ] && break; sleep 5; done
echo "$S" > "$3"; python3 -c "
import json; d=json.load(open('$3')); print('$3', d['status'], d['duration_ms'],'ms', d['tokens_input'], d['tokens_output'], d['cost_usd'], (d['error_message'] or '')[:200])"
