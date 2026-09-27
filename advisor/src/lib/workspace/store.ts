import { createClient } from "redis";

export interface Workspace { id: string; orgId: string; orgName: string; demo: false; keyCipher: string; keyHash: string; webhookId: string | null;
  webhookSecretCipher: string | null; mcpTokenHash: string | null; fitColumnId: number | null; fitFieldName: string | null; createdAt: string }
export interface WorkspaceStore { get(id: string): Promise<Workspace | null>; findByKeyHash(h: string): Promise<Workspace | null>;
  findByMcpTokenHash(h: string): Promise<Workspace | null>; put(w: Workspace): Promise<void>; remove(id: string): Promise<void>; list(): Promise<Workspace[]> }

export class MemoryWorkspaceStore implements WorkspaceStore {
  private m = new Map<string, Workspace>();
  async get(id: string) { return this.m.get(id) ?? null; }
  async findByKeyHash(h: string) { return [...this.m.values()].find((w) => w.keyHash === h) ?? null; }
  async findByMcpTokenHash(h: string) { return [...this.m.values()].find((w) => w.mcpTokenHash === h) ?? null; }
  async put(w: Workspace) { this.m.set(w.id, w); }
  async remove(id: string) { this.m.delete(id); }
  async list() { return [...this.m.values()]; }
}

export class RedisWorkspaceStore implements WorkspaceStore {
  private client = createClient({ url: process.env.REDIS_URL });
  private ready: Promise<unknown> | null = null;
  private async r() { if (!this.ready) this.ready = this.client.connect(); await this.ready; return this.client; }
  async get(id: string) { const v = await (await this.r()).get(`cc:ws:${id}`); return v ? (JSON.parse(v) as Workspace) : null; }
  async findByKeyHash(h: string) { const id = await (await this.r()).get(`cc:wskey:${h}`); return id ? this.get(id) : null; }
  async findByMcpTokenHash(h: string) { const id = await (await this.r()).get(`cc:wsmcp:${h}`); return id ? this.get(id) : null; }
  async put(w: Workspace) {
    const r = await this.r();
    await r.set(`cc:ws:${w.id}`, JSON.stringify(w)); await r.set(`cc:wskey:${w.keyHash}`, w.id); await r.sAdd("cc:ws:all", w.id);
    if (w.mcpTokenHash) await r.set(`cc:wsmcp:${w.mcpTokenHash}`, w.id);
  }
  async remove(id: string) {
    const r = await this.r(), w = await this.get(id);
    if (!w) return;
    await r.del([`cc:ws:${id}`, `cc:wskey:${w.keyHash}`, ...(w.mcpTokenHash ? [`cc:wsmcp:${w.mcpTokenHash}`] : [])]); await r.sRem("cc:ws:all", id);
  }
  async list() { const ids = await (await this.r()).sMembers("cc:ws:all"); return (await Promise.all(ids.map((id) => this.get(id)))).filter((w): w is Workspace => !!w); }
}

let store: WorkspaceStore | null = null;
export function workspaceStore(): WorkspaceStore { return (store ??= process.env.REDIS_URL ? new RedisWorkspaceStore() : new MemoryWorkspaceStore()); }
export function setWorkspaceStoreForTests(s: WorkspaceStore) { store = s; }
