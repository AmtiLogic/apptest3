"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function TopBar({ title, who }: { title: string; who?: string | null }) {
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="topbar">
      <div>
        <h1>{title}</h1>
        {who ? <div className="who">{who}</div> : null}
      </div>
      <nav className="nav">
        <Link className="button" href="/">
          Today
        </Link>
        <Link className="button" href="/activities">
          Activities
        </Link>
        <button type="button" onClick={signOut}>
          Sign out
        </button>
      </nav>
    </header>
  );
}
