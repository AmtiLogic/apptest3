# Garmin Dashboard

A small Next.js web app that signs in to Garmin Connect and reads your data:
today's activity summary, the last two weeks of steps, last night's sleep, and
your activity history.

<!-- Screenshots of the dashboard, activity list and activity detail live in the PR. -->

## How it connects to Garmin — read this first

Garmin has no self-serve public API. There are three ways in, and this app uses
the third:

1. **Garmin Connect Developer Program** (Health/Activity API) — the official
   route: OAuth plus push webhooks. It requires an application and approval from
   Garmin, so you cannot start with it today.
2. **FIT/TCX/GPX file import** — parse files exported from Garmin Connect. No
   credentials, no approval, fully within Garmin's terms.
3. **The Connect mobile client's own sign-in flow** — what this app does. It
   performs the same SSO + OAuth exchange the Garmin Connect mobile app performs,
   using your Garmin username and password, and then calls the internal
   `connectapi.garmin.com` endpoints.

**Route 3 comes with real caveats.** It is not a supported integration: it uses
Garmin's private endpoints, so it is **against Garmin's terms of service**, it can
break without notice whenever Garmin changes the login flow, and it means this app
handles your Garmin password directly. Treat it as a personal, single-user tool —
do not deploy it as a service for other people. If you need something durable or
multi-user, apply to the Developer Program and swap the data layer over (see
*Moving to the official API* below).

## Running it locally

```bash
npm install
npm run dev          # http://localhost:3000
```

Then sign in with your Garmin Connect email and password. If your account has
multi-factor authentication on, the app prompts for the code.

To try the UI without any Garmin account:

```bash
GARMIN_MOCK=1 npm run dev
```

Any email and password are accepted in mock mode and the app serves fixture data.

## Using it on your phone

The app is built mobile-first: two-up stat tiles, an activity list that reflows
from a table into cards, charts that respond to taps as well as hover, and a web
manifest so **Add to Home Screen** gives you a real app icon and a fullscreen,
browser-chrome-free window.

You still need somewhere to run it for **live** Garmin data, because of one hard
constraint:

> **GitHub Pages cannot sign in to Garmin.** Pages serves static files with no
> Node runtime, and the sign-in *must* happen server-side: `sso.garmin.com` and
> `connectapi.garmin.com` send no CORS headers, so a page served from
> `github.io` is blocked by the browser from reading their responses, and the
> cookie handoff the SSO flow depends on is cross-origin too. Routing it through
> a public CORS proxy would hand your Garmin password to a third party, so that
> is not a workaround. The same applies to any static-only host.

### What is published to GitHub Pages

`.github/workflows/deploy-pages.yml` builds a static bundle on every push and
publishes it from `main`, so the app itself is browsable at the Pages URL — every screen,
on a phone, installable to the home screen — running on **sample data**, with a
banner saying so and a `/setup` page explaining how to connect real data.

**One setting has to change for this to take effect:** in
*Settings → Pages → Source*, switch from **Deploy from a branch** to **GitHub
Actions**. Left on "Deploy from a branch", Pages runs Jekyll, which renders this
README as the site instead of building the app.

To build the same bundle locally:

```bash
npm run build:static      # writes out/
```

### Hosts that can serve live Garmin data

#### Vercel — easiest, free, no card, all from a browser

1. Go to [vercel.com/new](https://vercel.com/new), sign in with GitHub, and
   import this repository. It detects Next.js on its own and deploys `main`;
   accept the defaults.
2. Before deploying, add one environment variable:
   `APP_SECRET` = the output of `openssl rand -base64 32` (any 32+ random
   characters).
3. Deploy. You get an HTTPS URL like `your-app.vercel.app` — open it on your
   phone and use **Share → Add to Home Screen**.

Vercel runs the app across short-lived instances, which the app is built for:
the session lives in an encrypted cookie rather than server memory.

#### Any Docker host — Render, Fly.io, Railway, Koyeb, a machine at home

A `Dockerfile` is included and builds a standalone image.

```bash
docker build -t garmin-dashboard .
docker run -p 3000:3000 -e APP_SECRET="$(openssl rand -base64 32)" garmin-dashboard
```

On Render: New → Web Service → point at this repo → Docker → add `APP_SECRET`.

#### Keep it entirely private — your own machine + Tailscale

Run `npm run build && npm start` on a computer or Raspberry Pi you own, install
[Tailscale](https://tailscale.com) on it and on your phone, and open the
machine's Tailscale address from anywhere. Nothing is exposed to the public
internet and your Garmin password never leaves hardware you control. This is the
most private option; the trade-off is that the machine has to stay on.

#### One thing to decide before deploying anywhere shared

On Vercel or a Docker host, anyone who learns your URL reaches the Garmin
sign-in page. They cannot see your data without your Garmin password, but if you
would rather the app not be publicly reachable at all, use the Tailscale option,
or put your host's own access control in front of it.

## How credentials are handled

- Your password is sent to Garmin's SSO endpoint to obtain a token, and is **never
  written to disk, logged, or stored** by this app. It is dropped from the browser
  form as soon as the request returns.
- The resulting OAuth tokens are held **in server memory only**, keyed by an
  opaque, `httpOnly` session cookie. Tokens never reach the browser.
- The session cookie is encrypted and authenticated with AES-256-GCM under
  `APP_SECRET`, so its contents cannot be read or forged by the browser. It holds
  only the small, long-lived OAuth1 token; the large bearer token is cached in
  process memory and re-minted on demand, so nothing breaks when a host moves you
  between instances.
- Rotating `APP_SECRET` invalidates every existing session, which is how you sign
  all devices out.
- The long-lived OAuth1 token is used to mint new bearer tokens automatically, so
  your password is needed only once per session.

## What it shows

| Page | Data |
|---|---|
| `/` | Headline projection; stat tiles with week-on-week deltas; 28-day step chart with a 7-day forecast; training volume; last night's sleep |
| `/activities` | Paged activity history — type, date, distance, time, average HR |
| `/activities/[id]` | Per-activity detail — pace, moving time, elevation, HR, cadence, power |
| `/setup` | How to connect real data; shown from the sample-data banner |

## Projections

The dashboard forecasts where your steps are heading, and summarises training
volume. Both are deliberately conservative — the point is to be right, not to
look clever.

**Steps.** A linear trend plus an additive day-of-week effect. Step counts swing
hugely by weekday, and a plain straight line through the raw numbers reads that
weekly rhythm as noise and forecasts badly. The two parts are fitted by
backfitting to convergence: a single pass leaves the trend and the weekday term
correlated, because each weekday sits at a different average position in the
window, and the slope comes out wrong.

The forecast is drawn as a dashed line with a shaded interval (±1.96 residual
standard deviations — a normal approximation, indicative rather than exact at
this sample size).

Guard rails, because a confident wrong number is worse than no number:

- Fewer than 7 usable days → no forecast, and the UI says why.
- Fewer than 14 days → trend only; the weekday term needs two cycles to exist.
- Zero-step days are treated as *unworn watch*, not as a genuinely motionless
  day, and excluded — they otherwise crater the trend. Gaps stay gaps, because
  the model indexes on real dates rather than array position.
- When the fit is weak (R² < 0.15) or the weekly move is under 3%, the wording
  says "holding steady" instead of naming a direction the data cannot support.
- Counts are never projected below zero.

**Training volume.** This week's activity minutes against the average week of
the last four, reported as building / steady / winding down. A rough guide to
whether volume is climbing or falling — not a medical or injury-risk
assessment, and not presented as one. Direction arrows stay deliberately
neutral in colour: "ramping up fast" is a caution, and a green arrow would say
the opposite.

## Syncing

The **Sync** control in the header refetches everything and shows when it last
succeeded. It is disabled mid-flight and guarded against repeat taps, so
hammering it cannot stack concurrent requests. A failed sync leaves the previous
data on screen with an error strip above it, rather than blanking the page.

## Architecture

```
src/lib/garmin/
  oauth1.ts     RFC 5849 HMAC-SHA1 request signing
  sso.ts        the sign-in flow: cookies -> CSRF -> password -> (MFA) -> ticket
                -> OAuth1 token -> OAuth2 bearer token
  client.ts     authenticated calls to connectapi.garmin.com, with token refresh
  endpoints.ts  typed wrappers for the endpoints this app uses
  mock.ts       fixture data for GARMIN_MOCK=1 and the Pages bundle
src/lib/session.ts       encrypted, stateless session cookie (+ crypto-cookie.ts)
src/app/api/         auth and data routes (the browser never talks to Garmin)
src/lib/forecast.ts      trend + weekday model, fitted by backfitting
src/lib/trainingLoad.ts  acute vs chronic training volume
src/lib/insights.ts      turns model output into plain sentences
src/components/      stat tiles, charts, sync control
scripts/build-static.mjs  strips the server-only routes and exports for Pages
```

The sign-in sequence mirrors the one implemented by the
[`garth`](https://github.com/matin/garth) project, which documents Garmin's
current flow. The mobile-client OAuth consumer credentials are fetched at runtime
from the URL `garth` publishes; pin them with `GARMIN_CONSUMER_KEY` /
`GARMIN_CONSUMER_SECRET` if you would rather not depend on that.

## Tests

```bash
npm test        # OAuth1 signing, SSO response parsing, cookie jar, formatters
npm run build   # type-check and production build
```

The OAuth1 signer is checked against the worked example in RFC 5849 §3.4.1.1 and
against an independent HMAC-SHA1 reference computed with `openssl`.

## Limitations

- **The live sign-in path is not covered by the test suite.** It cannot be
  exercised without real Garmin credentials and network access to `garmin.com`;
  the tests cover the signing and parsing logic underneath it. If Garmin changes
  its login page, `sso.ts` is where it will break.
- Sessions are stateless cookies, so they survive restarts and multiple
  instances — but `APP_SECRET` must be set in production or the app refuses to
  serve requests.
- Units are metric throughout — distances in km, pace in min/km.
- Dates use the server's local timezone.
- Garmin rate-limits aggressive polling; repeated sign-ins in a short window can
  get you temporarily blocked.

## Moving to the official API

The data layer is isolated behind `src/lib/garmin/endpoints.ts`. Once you have
Developer Program access, implement the same function signatures against the
official Health/Activity API and the pages and API routes are unchanged. The
OAuth1 signer in `oauth1.ts` is reusable — the official API uses OAuth 1.0a too.
