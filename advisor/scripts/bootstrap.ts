import { g8Caller } from "../src/lib/g8/client";
import { OPS } from "../src/lib/g8/ops";
import { ensureSchema } from "../src/lib/store/schema";

const objects = await g8Caller.call<{ slug: string }[]>(OPS.listObjects);
if (objects.some((o) => o.slug === "roi_probe") && process.argv.includes("--archive-probe")) {
  await g8Caller.call(OPS.archiveObject, { path: { object_slug: "roi_probe" } });
  console.log("archived roi_probe");
}
console.log(JSON.stringify(await ensureSchema(g8Caller)));
const fields = await g8Caller.call<{ id: number; title: string; name: string }[]>(OPS.listFields);
for (const title of ["roi_fit_reason", "record_consistency"]) {
  const f = fields.find((x) => x.title === title);
  if (f) { console.log(`field ${title} exists: ${f.id} ${f.name}`); continue; }
  const created = await g8Caller.call<{ id: number; name: string }>(OPS.createField, { body: { title, entity: "contacts", data_type: "text" } });
  console.log(`created field ${title}: ${created.id} ${created.name}`);
}
