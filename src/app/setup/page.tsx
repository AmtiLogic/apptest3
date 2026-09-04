import Link from "next/link";

export const metadata = { title: "Connect your Garmin data" };

export default function SetupPage() {
  return (
    <main className="shell prose">
      <header className="topbar">
        <h1>Connect your data</h1>
        <nav className="nav">
          <Link className="button" href="/">
            Back
          </Link>
        </nav>
      </header>

      <section className="card">
        <h2>Why this page exists</h2>
        <p>
          GitHub Pages is a static file host. It has no server, and the Garmin
          sign-in cannot run in the browser: <code>sso.garmin.com</code> and{" "}
          <code>connectapi.garmin.com</code> send no CORS headers, so a page served
          from <code>github.io</code> is blocked from reading their responses, and
          the cookie handoff the sign-in depends on is cross-origin.
        </p>
        <p>
          So this build shows sample data. To read your own data, run the same app
          somewhere that executes Node. It takes a few minutes and costs nothing.
        </p>
      </section>

      <section className="card">
        <h2>Option 1 — Vercel, from this phone</h2>
        <ol>
          <li>
            Open <code>vercel.com/new</code> and sign in with GitHub.
          </li>
          <li>
            Import the <code>apptest3</code> repository. Next.js is detected
            automatically and it deploys the <code>main</code> branch.
          </li>
          <li>
            Add one environment variable — <code>APP_SECRET</code> — set to 32 or
            more random characters. It encrypts your session cookie.
          </li>
          <li>Deploy, then open the URL it gives you and sign in with Garmin.</li>
        </ol>
        <p className="muted">Free tier, no card required.</p>
      </section>

      <section className="card">
        <h2>Option 2 — keep it fully private</h2>
        <p>
          Run <code>npm run build &amp;&amp; npm start</code> on a computer you own,
          install Tailscale on it and on your phone, and open the machine&rsquo;s
          Tailscale address. Nothing is exposed to the internet and your Garmin
          password never leaves your own hardware. A <code>Dockerfile</code> is
          included if you would rather run a container.
        </p>
      </section>

      <section className="card">
        <h2>Worth knowing</h2>
        <p>
          This app signs in the way the Garmin Connect mobile app does and calls
          Garmin&rsquo;s internal endpoints. That is against Garmin&rsquo;s terms of
          service and can break whenever they change their login flow. It is
          intended as a personal, single-user tool.
        </p>
      </section>
    </main>
  );
}
