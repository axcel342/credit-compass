export interface ProviderRow { provider: string; credits_per_row: Record<string, number> }

export function smoothedRate(meetings: number, reached: number, orgRate: number, k = 5): number {
  return (meetings + k * orgRate) / (reached + k);
}

export function classifyFit(p: { rate: number; orgRate: number; n: number; consistency: "ok" | "flagged" | "unknown" }): "high" | "medium" | "low" | "unknown" {
  if (p.consistency === "flagged") return "low";
  if (p.n < 3) return "unknown";
  if (p.orgRate <= 0) return "unknown";
  if (p.rate >= 1.5 * p.orgRate) return "high";
  if (p.rate <= 0.5 * p.orgRate) return "low";
  return "medium";
}

export function calibrationFactor(history: { quoted: number; actual: number }[]): number {
  const q = history.reduce((s, h) => s + h.quoted, 0), a = history.reduce((s, h) => s + h.actual, 0);
  return q > 0 ? a / q : 1;
}

export function estimateCredits(p: { records: number; pricePerRecord: number; calibration?: number }): number {
  return Math.round(p.records * p.pricePerRecord * (p.calibration ?? 1));
}

export function bestFitSubset(contacts: { contactId: number; expectedRate: number; consistency: string }[], p: { pricePerRecord: number; orgCostPerMeeting: number }): number[] {
  return contacts.filter((c) => c.consistency !== "flagged" && c.expectedRate > 0)
    .sort((a, b) => b.expectedRate - a.expectedRate)
    .filter((c) => p.pricePerRecord / c.expectedRate <= p.orgCostPerMeeting)
    .map((c) => c.contactId);
}

export function priceFor(providers: ProviderRow[], provider: string, action: string): number | null {
  return providers.find((x) => x.provider === provider)?.credits_per_row[action] ?? null;
}