import { cache } from "react";
import { cookies } from "next/headers";
import { g8Caller, callerFor, type G8Caller } from "../g8/client";
import { decrypt } from "./crypto";
import { workspaceStore } from "./store";
import { verifySession, WORKSPACE_COOKIE } from "./session";

export interface CurrentWorkspace { id: string; demo: boolean; orgId: string; orgName: string; fitColumnId: number; fitFieldName: string; caller: G8Caller }

const demo = (): CurrentWorkspace => ({ id: "demo", demo: true, orgId: process.env.G8_ORG_ID ?? "", orgName: "Demo workspace",
  fitColumnId: Number(process.env.ROI_FIT_COLUMN_ID ?? 757), fitFieldName: process.env.ROI_FIT_FORMULA_NAME ?? "udo_roi_fit_11e946f0", caller: g8Caller });

export const currentWorkspace = cache(async (): Promise<CurrentWorkspace> => {
  let id: string | null = null;
  try { id = verifySession((await cookies()).get(WORKSPACE_COOKIE)?.value); } catch { id = null; } // outside a request (scripts, tests)
  if (!id) return demo();
  const w = await workspaceStore().get(id);
  if (!w) return demo();
  return { id: w.id, demo: false, orgId: w.orgId, orgName: w.orgName, fitColumnId: w.fitColumnId ?? 0, fitFieldName: w.fitFieldName ?? "",
    caller: callerFor(decrypt(w.keyCipher, process.env.WORKSPACE_KEY_SECRET ?? "")) };
});

export const currentCaller = cache(async (): Promise<G8Caller> => (await currentWorkspace()).caller);
