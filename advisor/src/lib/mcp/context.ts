import { AsyncLocalStorage } from "node:async_hooks";
import type { G8Caller } from "../g8/client";
export const mcpWorkspace = new AsyncLocalStorage<G8Caller>();
