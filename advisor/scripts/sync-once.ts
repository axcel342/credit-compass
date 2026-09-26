import { g8Caller } from "../src/lib/g8/client";
import { runSync } from "../src/lib/sync/run-sync";
console.log(JSON.stringify(await runSync({ c: g8Caller }), null, 2));
