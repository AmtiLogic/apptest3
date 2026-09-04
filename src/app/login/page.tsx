"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IS_STATIC_DEMO } from "@/lib/staticDemo";

type Step = "credentials" | "mfa";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function post(path: string, body: unknown) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as
      | { status?: string; error?: string }
      | null;
    if (!res.ok) throw new Error(json?.error ?? `Sign-in failed (${res.status})`);
    return json;
  }

  async function submitCredentials(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await post("/api/auth/login", { email, password });
      // The password is dropped here; the MFA step runs off a server-side cookie.
      setPassword("");
      if (result?.status === "mfa_required") setStep("mfa");
      else router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post("/api/auth/mfa", { code });
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  if (IS_STATIC_DEMO) {
    return (
      <main className="login-wrap">
        <div className="card login-card">
          <h1 style={{ fontSize: 18, margin: "0 0 4px" }}>Garmin Dashboard</h1>
          <p className="sub">
            This is the GitHub Pages build. Pages serves static files and cannot run
            the server that signs in to Garmin, so there is nothing to sign in to here.
          </p>
          <Link className="button primary-link" href="/">
            Explore with sample data
          </Link>
          <p className="sub" style={{ marginTop: 14, marginBottom: 0 }}>
            To read your own Garmin data, deploy the app to a host that runs Node —{" "}
            <Link href="/setup/">the setup page</Link> walks through it.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="login-wrap">
      <div className="card login-card">
        <h1 style={{ fontSize: 18, margin: "0 0 4px" }}>Garmin Dashboard</h1>
        <p className="sub">
          {step === "credentials"
            ? "Sign in with your Garmin Connect account."
            : "Enter the verification code Garmin just sent you."}
        </p>

        {error ? <div className="notice error">{error}</div> : null}

        {step === "credentials" ? (
          <form onSubmit={submitCredentials}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button className="primary" type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitCode}>
            <label htmlFor="code">Verification code</label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button className="primary" type="submit" disabled={busy}>
              {busy ? "Verifying…" : "Verify"}
            </button>
          </form>
        )}

        <p className="sub" style={{ marginTop: 14, marginBottom: 0 }}>
          Your credentials are sent to Garmin to obtain a token and are never stored by
          this app.
        </p>
      </div>
    </main>
  );
}
