import { createApiClient, g8, G8Error } from "@graph8/sdk";
import { RateLimiter } from "./rate-limit";

export interface CallInput { path?: Record<string, string | number>; query?: Record<string, unknown>; body?: unknown }
export interface G8Caller {
  call<T = unknown>(op: string, input?: CallInput): Promise<T>;
  callRaw<T = unknown>(op: string, input?: CallInput): Promise<T>;
}

const limiter = new RateLimiter({ perSecond: 40, perMinute: 900 });
let initialised = false;

function init(): void {
  if (initialised) return;
  const apiKey = process.env.G8_API_KEY;
  if (!apiKey) throw new Error("G8_API_KEY is not set. Add it to advisor/.env.local or the Vercel project settings.");
  g8.init({ apiKey });
  initialised = true;
}

export function unwrap<T>(res: unknown): T {
  if (res && typeof res === "object" && "data" in (res as Record<string, unknown>)) return (res as { data: T }).data;
  return res as T;
}

export const g8Caller: G8Caller = {
  async callRaw<T>(op: string, input: CallInput = {}): Promise<T> {
    init();
    await limiter.take();
    // g8.api.call is typed against the generated ApiOperationId union; OPS values are checked by tests/g8/contract.test.ts.
    return (await (g8.api.call as (id: string, i: CallInput) => Promise<unknown>)(op, input)) as T;
  },
  async call<T>(op: string, input: CallInput = {}): Promise<T> {
    return unwrap<T>(await this.callRaw(op, input));
  },
};

const perKey = new Map<string, G8Caller>();
export function callerFor(apiKey: string): G8Caller {
  const hit = perKey.get(apiKey);
  if (hit) return hit;
  const api = createApiClient(apiKey);
  const own = new RateLimiter({ perSecond: 40, perMinute: 900 });
  const c: G8Caller = {
    async callRaw<T>(op: string, input: CallInput = {}) { await own.take(); return (await (api.call as (id: string, i: CallInput) => Promise<unknown>)(op, input)) as T; },
    async call<T>(op: string, input: CallInput = {}) { return unwrap<T>(await this.callRaw(op, input)); },
  };
  perKey.set(apiKey, c);
  return c;
}

export function isConflict(e: unknown): boolean { return e instanceof G8Error && e.status === 409; }
export function isNotFound(e: unknown): boolean { return e instanceof G8Error && e.status === 404; }
