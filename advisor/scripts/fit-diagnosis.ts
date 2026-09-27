import { g8Caller as c } from "../src/lib/g8/client";
import { loadContactIndex } from "../src/lib/sync/contacts";
import { RecordStore } from "../src/lib/store/records";
import { valuesToStat } from "../src/lib/store/mappers";

const contacts = await loadContactIndex(c);
const seg = new Map<string, number>();
for (const info of contacts.values()) seg.set(info.segmentKey, (seg.get(info.segmentKey) ?? 0) + 1);
const sizes = [...seg.values()];
const stats = (await new RecordStore(c, "roi_stat").list()).map((r) => valuesToStat(r.values)).filter((s) => s.dimension === "segment" && s.period === "8w");
console.log(JSON.stringify({ contacts: contacts.size, segments: seg.size, contactsInSegmentsOf3Plus: sizes.filter((x) => x >= 3).reduce((a, b) => a + b, 0),
  segmentStatsWithReach3Plus: stats.filter((s) => s.contactsReached >= 3).length, segmentStats: stats.length }));

const cached = await new RecordStore(c, "roi_contact").list().catch(() => []);
const byFit: Record<string, number> = {};
for (const r of cached) byFit[String(r.values.fit)] = (byFit[String(r.values.fit)] ?? 0) + 1;
console.log(JSON.stringify({ cachedContacts: cached.length, byFit }));
