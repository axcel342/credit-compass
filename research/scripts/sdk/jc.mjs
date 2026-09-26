import { g8 } from '@graph8/sdk';
import fs from 'fs';
g8.init({ apiKey: process.env.G8_API_KEY });
const bal = async () => (await g8.api.call('get_usage_usage_get', {}).catch(async () => null));
const urls = JSON.parse(process.argv[2]); const out = process.argv[3];
const res = await g8.api.call('match_job_change_signals_hiring_signals_job_changes_match_post', { body: { linkedin_urls: urls } }).catch(e => ({ err: String(e) }));
fs.writeFileSync(out, JSON.stringify(res, null, 1)); console.log(JSON.stringify(res).slice(0, 1500));
