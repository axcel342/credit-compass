import { g8 } from '@graph8/sdk';
g8.init({ apiKey: process.env.G8_API_KEY });
const call = (id, input = {}) => g8.api.call(id, input).catch(e => ({ __err: String(e).slice(0, 200) }));
const poll = async id => { for (let i = 0; i < 40; i++) { const e = await call('get_execution_workflows_executions__execution_id__get', { path: { execution_id: id } }); const d = e.data ?? e; if (!['pending','running','queued'].includes(d.status)) return d; await new Promise(r => setTimeout(r, 4000)); } };
// (a) free workflow run: the web_search-only workflow
const a = await call('execute_workflow_workflows__action_id__execute_post', { path: { action_id: '712e4f5b-faee-45fd-9150-ea5853cc08dd' }, body: { input_data: { q: 'capture probe' } } });
const ra = await poll(a.execution_id ?? a.data?.execution_id);
console.log('(a) workflow run', ra?.execution_id, ra?.status);
// (b) standalone skill run (gpt-4o clone of Buying Signals Scan)
const b = await call('execute_skill_skills__action_id__execute_post', { path: { action_id: '7faf5ecf-a506-487d-a3fb-1c5265bacc63' }, body: { input_data: { company_name: 'Listrak' } } });
const rb = await poll(b.execution_id ?? b.data?.execution_id);
console.log('(b) skill run', rb?.execution_id, rb?.status, rb?.tokens_input, rb?.tokens_output);
