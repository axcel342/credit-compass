import { g8Caller as c } from "../src/lib/g8/client";
import { OPS } from "../src/lib/g8/ops";
const r = await c.call<unknown>(OPS.listPipelineTemplates);
console.log(JSON.stringify(r, null, 1).slice(0, 4000));
