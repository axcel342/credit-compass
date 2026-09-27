import { g8Caller as c } from "../src/lib/g8/client";
import { loadDashboardData, periodView } from "../src/lib/dashboard/data";
import { repeatEnrichment } from "../src/lib/domain/repeat";
import { BUCKETS } from "../src/lib/domain/buckets";
import { toMs } from "../src/lib/domain/time";

const d = await loadDashboardData(c);
const v = periodView(d, "8w");
const total = v.charges.reduce((s, x) => s + x.credits, 0);
const bucketSum = BUCKETS.reduce((s, b) => s + v.buckets[b], 0);
const perList = v.stats.filter((s) => s.dimension === "list" && s.meetings > 0).map((s) => [d.listNames.get(s.value) ?? s.value, s.costPerMeeting, s.meetings]);
const rep = repeatEnrichment(v.charges);
const firstWeek = new Map<number, number>();
for (const ch of v.charges) if (ch.contactId !== null) firstWeek.set(ch.contactId, Math.min(firstWeek.get(ch.contactId) ?? Infinity, toMs(ch.chargedAt)));
const weeks = new Set([...firstWeek.values()].map((t) => Math.floor((t - v.window.from) / (7 * 86_400_000))));
console.log(JSON.stringify({ total: Math.round(total), bucketsAddUp: Math.abs(total - bucketSum) < 0.01, buckets: v.buckets, perList,
  repeatShare: +(rep.credits / total).toFixed(3), cohortWeeks: weeks.size, meetings: v.meetings, won: v.won }, null, 1));
