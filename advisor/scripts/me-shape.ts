const r = await fetch("https://be.graph8.com/api/v1/me", { headers: { Authorization: `Bearer ${process.env.G8_API_KEY}`, "User-Agent": "credit-compass" } });
const body = await r.json() as Record<string, unknown>;
const d = (body.data ?? body) as Record<string, unknown>;
console.log(r.status, "top-level keys:", Object.keys(d));
for (const k of Object.keys(d)) if (/org|organi[sz]ation|user|name/i.test(k)) console.log(k, "=>", JSON.stringify(d[k]).slice(0, 200));
export {};
