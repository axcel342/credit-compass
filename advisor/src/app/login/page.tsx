"use client";
import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <main className="page" style={{ maxWidth: 420 }}>
      <h1>Credit Compass</h1>
      <form action={action} style={{ display: "grid", gap: 10 }}>
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" />
        <button className="btn primary" type="submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
        {state?.error && <p role="alert">{state.error}</p>}
      </form>
      <p className="small">Using your own graph8 org? <a href="/connect">Connect your graph8 account</a>.</p>
    </main>
  );
}
