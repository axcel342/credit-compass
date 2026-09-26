import { g8Caller } from "../src/lib/g8/client";
import { OPS } from "../src/lib/g8/ops";
const u = await g8Caller.call<{ available_credits: number }>(OPS.getUsage);
console.log("available credits:", u.available_credits);
