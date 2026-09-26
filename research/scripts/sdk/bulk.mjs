import { g8 } from '@graph8/sdk';
g8.init({ apiKey: process.env.G8_API_KEY });
const N = 50, C = 10; const res = { ok: 0, dup: 0, err: {}, lat: [] };
const one = async i => {
  const t = Date.now();
  try {
    await g8.api.call('create_object_record_objects__object_slug__records_post', { path: { object_slug: 'roi_probe' },
      body: { values: { ext_id: i === N - 1 ? 'bulk-0' : `bulk-${i}`, service: 'bulk_test', credits: i, charged_at: new Date().toISOString() } } });
    res.ok++;
  } catch (e) { const s = String(e); if (/already has this|409|conflict/i.test(s)) res.dup++; else res.err[s.slice(0, 80)] = (res.err[s.slice(0, 80)] || 0) + 1; }
  res.lat.push(Date.now() - t);
};
const t0 = Date.now(); let next = 0;
await Promise.all(Array.from({ length: C }, async () => { while (next < N) await one(next++); }));
const s = res.lat.sort((a, b) => a - b);
console.log(JSON.stringify({ written: res.ok, duplicates_rejected: res.dup, errors: res.err, seconds: (Date.now() - t0) / 1000, p50_ms: s[s.length >> 1], p95_ms: s[Math.floor(s.length * 0.95)] }));
