import type { AttributedCharge } from "./types";
import { toMs } from "./time";

export interface RepeatSummary { credits: number; charges: number; contacts: number; byList: Map<number | null, number>; ledgerIds: string[]; simulated: boolean }

export function repeatEnrichment(charges: AttributedCharge[], windowDays = 30): RepeatSummary {
  const win = windowDays * 86_400_000;
  const lastSuccess = new Map<string, number>();
  const out: RepeatSummary = { credits: 0, charges: 0, contacts: 0, byList: new Map(), ledgerIds: [], simulated: false };
  const who = new Set<number>();
  for (const c of [...charges].sort((a, b) => toMs(a.chargedAt) - toMs(b.chargedAt))) {
    if (c.contactId === null) continue;
    const key = `${c.contactId}|${c.service}`, t = toMs(c.chargedAt), prev = lastSuccess.get(key);
    if (prev !== undefined && t - prev <= win && !c.isWaste) {
      out.credits += c.credits; out.charges++; out.ledgerIds.push(c.ledgerId); who.add(c.contactId);
      out.byList.set(c.listId, (out.byList.get(c.listId) ?? 0) + c.credits);
      out.simulated ||= c.simulated;
    }
    if (c.result === "success") lastSuccess.set(key, t);
  }
  out.contacts = who.size;
  return out;
}
