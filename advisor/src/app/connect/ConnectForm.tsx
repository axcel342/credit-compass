"use client";
import { useActionState } from "react";
import Link from "next/link";
import { connect } from "./actions";
export function ConnectForm() {
  const [state, action, pending] = useActionState(connect, undefined);
  if (state?.ok) return (
    <div className="panel"><p>{state.message}</p>
      {state.mcpToken && <><p className="small">Your MCP token (shown once; add it to Claude or Cursor as the bearer token for /api/mcp):</p><pre className="code">{state.mcpToken}</pre></>}
      <Link className="btn primary" href="/">Open your dashboard</Link></div>);
  return (
    <form action={action} className="panel" style={{ display: "grid", gap: 10 }}>
      <label htmlFor="apiKey">graph8 API key</label>
      <input id="apiKey" name="apiKey" type="password" autoComplete="off" required placeholder="Paste a key from graph8 → Settings → API" />
      <p className="small">Credit Compass reads your ledger, lists, deals and pipelines, and stores its results in custom objects inside your own graph8 org. The key is encrypted and never shown again.</p>
      <button className="btn primary" type="submit" disabled={pending}>{pending ? "Connecting and running the first sync…" : "Connect"}</button>
      {state && !state.ok && <p role="alert">{state.message}</p>}
    </form>);
}
