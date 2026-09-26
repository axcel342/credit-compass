export function rootDomain(d: string | null): string {
  return (d ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
}

export function emailDomain(email: string | null): string {
  if (!email || !email.includes("@")) return "";
  return rootDomain(email.split("@").pop() ?? "");
}

export function recordConsistency(email: string | null, companyDomain: string | null): "ok" | "flagged" | "unknown" {
  const e = emailDomain(email), c = rootDomain(companyDomain);
  if (!e || !c) return "unknown";
  return e === c || e.endsWith(`.${c}`) || c.endsWith(`.${e}`) ? "ok" : "flagged";
}

export function segmentKey(p: { seniority?: string | null; department?: string | null; industry?: string | null; employeeCount?: string | null }): string {
  const v = (x?: string | null) => (x && x.trim() ? x.trim() : "Unknown");
  return [v(p.seniority), v(p.department), v(p.industry), v(p.employeeCount)].join("|");
}
