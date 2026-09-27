import { cache } from "react";
import { g8Caller, type G8Caller } from "../g8/client";

/** The graph8 caller for this request. Phase 3 (Task 13) makes it per workspace; pages never import g8Caller directly. */
export const currentCaller = cache(async (): Promise<G8Caller> => g8Caller);
