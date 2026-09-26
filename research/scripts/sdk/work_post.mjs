import { g8 } from '@graph8/sdk';
g8.init({ apiKey: process.env.G8_API_KEY });
const msg = [
  '**[sim] ROI Advisor · weekly recap (probe)**',
  'Last 7 days: 137 credits → 1 won deal ($12,000) · 91 credits on failed/unreadable work',
  '1. ⛔ 77 credits charged on AI enrichment jobs that failed on every record — refund request ready',
  '2. 💡 roi_fit guardrail skipped 2 low-fit contacts in "[sim] guardrail probe"',
  '3. 📦 23 onboarding documents paid for, never used',
].join('\n');
const r = await g8.api.call('create_work_message_work_messages_post', { body: { channel: 'work', message: msg } }).catch(e => ({ err: String(e).slice(0, 300) }));
console.log(JSON.stringify(r).slice(0, 600));
