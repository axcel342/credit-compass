const RE = /^(\d{4}-\d\d-\d\d)[T ](\d\d:\d\d:\d\d)(\.\d+)?(Z|[+-]\d\d:?\d\d)?$/;

export function toMs(ts: string): number {
  const m = RE.exec(ts.trim());
  if (!m) throw new Error(`Unparseable timestamp: ${ts}`);
  const frac = m[3] ? m[3].slice(0, 4) : "";
  let tz = m[4] ?? "Z";
  if (tz !== "Z" && !tz.includes(":")) tz = `${tz.slice(0, 3)}:${tz.slice(3)}`;
  const v = Date.parse(`${m[1]}T${m[2]}${frac}${tz}`);
  if (Number.isNaN(v)) throw new Error(`Unparseable timestamp: ${ts}`);
  return v;
}

export function toIso(ms: number): string { return new Date(ms).toISOString(); }
