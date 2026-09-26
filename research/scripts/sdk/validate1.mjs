import { g8 } from '@graph8/sdk';
import fs from 'fs';
g8.init({ apiKey: process.env.G8_API_KEY });
const call = (id, input = {}) => g8.api.call(id, input).catch(e => ({ __err: String(e).slice(0, 200) }));
const out = {};

// 1. Ledger paging + row types, via SDK
let rows = [], page = 1;
while (true) {
  const r = await call('list_usage_transactions_usage_transactions_get', { query: { page, limit: 100 } });
  const d = r.data ?? r; if (!Array.isArray(d) || !d.length) break;
  rows.push(...d); if (d.length < 100) break; page++;
}
const usage = rows.filter(t => t.type === 'usage');
out.ledger = { rows: rows.length, pages: page, usage_rows: usage.length, usage_credits: -usage.reduce((s, t) => s + t.amount, 0),
  types: [...new Set(rows.map(t => t.type))] };

// 2. LLM charge <-> execution: measure charged_at - completed_at gap
const ids = JSON.parse(fs.readFileSync('../exec_ids.json'));
const gaps = [];
for (const id of ids) {
  const e = await call('get_execution_workflows_executions__execution_id__get', { path: { execution_id: id } });
  const x = e.data ?? e; if (!x.tokens_input) continue;
  const t = usage.find(u => (u.description || '').includes(`in:${x.tokens_input}, out:${x.tokens_output}`));
  if (t) gaps.push(Math.round((Date.parse(t.created_at.replace(' ', 'T').slice(0, 23) + 'Z') - Date.parse(x.completed_at)) / 1000));
}
out.token_join = { executions_checked: ids.length, matched: gaps.length, gap_seconds: gaps };

// 3. AI-enrichment pricing: group ai_enrichment charges by second
const ai = usage.filter(t => t.service === 'ai_enrichment');
const bySec = {}; ai.forEach(t => { const k = t.created_at.slice(11, 16); bySec[k] = (bySec[k] || []).concat(t.amount); });
out.ai_enrichment_minutes = bySec;

// 4. Deal history + contact memberships + engagement
const deal = '13d1fb15-1014-4da8-9ec6-9c1b4785e17f';
out.deal_history = await call('list_deal_history_deals__deal_id__history_get', { path: { deal_id: deal } });
out.contact_lists = await call('get_contact_lists_contacts__contact_id__lists_get', { path: { contact_id: 81 } });
out.contact_sequences = await call('get_contact_sequences_contacts__contact_id__sequences_get', { path: { contact_id: 81 } });
out.engagement = await call('get_contact_engagement_summary_contacts__contact_id__engagement_summary_get', { path: { contact_id: 81 } });

// 5. Waterfall estimate (free) for 10 contacts on list 2
out.waterfall_estimate = await call('validate_waterfall_enrichment_credits_enrichment_waterfall_validate_credits_post',
  { body: { list_id: 2, record_ids: [66, 81, 21, 77, 164, 169, 184, 189, 198, 231] } });

fs.writeFileSync('../validate1.json', JSON.stringify(out, null, 1));
for (const [k, v] of Object.entries(out)) console.log(`== ${k}\n${JSON.stringify(v).slice(0, 700)}`);
