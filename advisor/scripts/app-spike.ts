import { g8Caller as c } from "../src/lib/g8/client";
import { OPS } from "../src/lib/g8/ops";
import { G8Error } from "@graph8/sdk";
console.log("before:", JSON.stringify(await c.call(OPS.listApps)));
try {
  const app = await c.call<Record<string, unknown>>(OPS.createApp, { body: { name: "Credit Compass", slug: "credit-compass" } });
  console.log("created:", JSON.stringify(app));
} catch (e) {
  if (e instanceof G8Error) console.log("refused:", e.status, e.code ?? "", e.message); else throw e;
}
