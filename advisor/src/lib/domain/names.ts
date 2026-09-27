const SERVICE: Record<string, string> = {
  waterfall_enrichment: "Email finding", studio_global: "Onboarding research", ai_enrichment: "AI enrichment",
  email_verification: "Email verification", studio_copilot: "Agent replies", voice_llm: "Skill runs",
  landing_page_template: "Landing page", image_generation: "Image generation", brand_snapshot_classify: "Brand classifier",
};

export function serviceName(service: string): string {
  return SERVICE[service] ?? service.replace(/_/g, " ").replace(/^./, (ch) => ch.toUpperCase());
}

export function listLabel(title: string): string {
  const t = title.replace(/^\[sim\]\s*/, "").replace(/\s*\(proactive setup\)$/, "").trim();
  return /\bprobe$/i.test(t) ? "Test list" : t;
}

export function listNamesFrom(lists: { id: number; title: string }[]): Map<string, string> {
  const counts = new Map<string, number>();
  for (const l of lists) counts.set(listLabel(l.title), (counts.get(listLabel(l.title)) ?? 0) + 1);
  return new Map(lists.map((l) => {
    const label = listLabel(l.title);
    return [String(l.id), (counts.get(label) ?? 0) > 1 ? `${label} (${l.id})` : label];
  }));
}
