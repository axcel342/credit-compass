import { g8 } from '@graph8/sdk';
g8.init({ apiKey: process.env.G8_API_KEY });
const call = (id, input) => g8.api.call(id, input).catch(e => ({ err: String(e).slice(0, 300) }));
const bal = async () => ((await call('get_usage_usage_get', {})).data || {}).available_credits;
const b0 = await bal();
const ch = await call('create_work_channel_work_channels_post', { body: { name: 'roi-advisor', displayName: 'ROI Advisor [sim]', description: '[sim] quiet channel for ROI recaps (no agents)', kind: 'stream', visibility: 'open', participantAgentIds: [] } });
const c = ch.data ?? ch; console.log('channel:', c.name ?? c.err, '| agents:', JSON.stringify(c.participantAgentIds));
const m = await call('create_work_message_work_messages_post', { body: { channel: c.id ?? 'roi-advisor', document: { version: 1, blocks: [
  { type: 'paragraph', content: [{ type: 'text', text: '[sim] ROI Advisor · quiet-channel probe', marks: [{ type: 'bold' }] }] },
  { type: 'paragraph', content: [{ type: 'text', text: 'If no agent replies and no credits are charged, recaps can live here for free.' }] } ] } } });
console.log('message:', (m.data ?? m).id ? 'posted' : JSON.stringify(m).slice(0, 200));
await new Promise(r => setTimeout(r, 45000));
const b1 = await bal(); console.log(`credits ${b0} -> ${b1}`);
const msgs = await call('list_work_conversation_messages_work_conversations__conversation_id__messages_get', { path: { conversation_id: c.id }, query: { limit: 10 } });
const list = (msgs.data?.messages ?? msgs.data ?? msgs.messages ?? []);
console.log('messages in channel after 45s:', Array.isArray(list) ? list.length : JSON.stringify(msgs).slice(0, 200));
