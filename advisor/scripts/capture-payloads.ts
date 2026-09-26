import { g8Caller } from "../src/lib/g8/client";
import { OPS } from "../src/lib/g8/ops";

const deal = await g8Caller.call<{ id: string }>(OPS.createDeal, { body: {
  name: "[sim] payload capture", contact_ids: [81], owner_id: "mominimran000@gmail.com", amount: 1000,
  stage_id: "2df1e28d-344c-4940-8bc2-e456bfd874a8", description: "[sim] created to capture webhook payload shapes",
  allow_duplicate: true } });
await g8Caller.call(OPS.updateDeal, { path: { deal_id: deal.id }, body: { stage_id: "2e65b28e-5fc4-49f5-966e-5e8081a921c2" } });
const run = await g8Caller.callRaw<{ execution_id: string }>(OPS.executeWorkflow, { path: { action_id: "712e4f5b-faee-45fd-9150-ea5853cc08dd" }, body: { input_data: { q: "payload capture" } } });
console.log(JSON.stringify({ dealId: deal.id, executionId: run.execution_id }));
