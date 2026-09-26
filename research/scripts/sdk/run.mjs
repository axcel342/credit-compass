import { g8 } from '@graph8/sdk';
g8.init({ apiKey: process.env.G8_API_KEY });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function run(action_id, input_data) {
  const start = await g8.api.call('execute_skill_skills__action_id__execute_post', { path: { action_id }, body: { input_data } });
  const id = start.execution_id ?? start.data?.execution_id;
  for (let i = 0; i < 40; i++) {
    const ex = await g8.api.call('get_execution_workflows_executions__execution_id__get', { path: { execution_id: id } }).catch(e => ({ err: String(e) }));
    const d = ex.data ?? ex;
    if (d.err || !['pending','running'].includes(d.status)) return d;
    await sleep(4000);
  }
}
console.log(JSON.stringify(g8.api.operation('execute_skill_skills__action_id__execute_post')));
const sys = await run('7faf5ecf-a506-487d-a3fb-1c5265bacc63'.replace(/.*/, '1da87550-6d42-4f3d-a4e6-a2a29f5d4568'), { company_name: 'ShipHawk' });
console.log('SYSTEM:', sys.status, (sys.error_message || sys.err || '').slice(0, 160));
const clone = await run('7faf5ecf-a506-487d-a3fb-1c5265bacc63', { company_name: 'ShipHawk' });
console.log('CLONE:', clone.status, clone.tokens_input, clone.tokens_output);
console.log(clone.output_data?.result);
