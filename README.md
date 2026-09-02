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

## Running it

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

## How credentials are handled

- Your password is sent to Garmin's SSO endpoint to obtain a token, and is **never
  written to disk, logged, or stored** by this app. It is dropped from the browser
  form as soon as the request returns.
- The resulting OAuth tokens are held **in server memory only**, keyed by an
  opaque, `httpOnly` session cookie. Tokens never reach the browser.
- Because sessions live in memory, they are lost on server restart, and the app
  will not work correctly across multiple server instances (a load-balanced
  deployment would need a shared store — see *Limitations*).
- The long-lived OAuth1 token is used to mint new bearer tokens automatically, so
  your password is needed only once per session.

## What it shows

| Page | Data |
|---|---|
| `/` | Steps, distance, calories, resting HR, Body Battery, active time; 14-day step chart; last night's sleep stages |
| `/activities` | Paged activity history — type, date, distance, time, average HR |
| `/activities/[id]` | Per-activity detail — pace, moving time, elevation, HR, cadence, power |

## Architecture

```
src/lib/garmin/
  oauth1.ts     RFC 5849 HMAC-SHA1 request signing
  sso.ts        the sign-in flow: cookies -> CSRF -> password -> (MFA) -> ticket
                -> OAuth1 token -> OAuth2 bearer token
  client.ts     authenticated calls to connectapi.garmin.com, with token refresh
  endpoints.ts  typed wrappers for the endpoints this app uses
  mock.ts       fixture data for GARMIN_MOCK=1
src/lib/session.ts   in-memory session store behind an httpOnly cookie
src/app/api/         auth and data routes (the browser never talks to Garmin)
src/components/      stat tiles and the two charts
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
- Sessions are in-memory and single-process (see above).
- Units are metric throughout — distances in km, pace in min/km.
- Dates use the server's local timezone.
- Garmin rate-limits aggressive polling; repeated sign-ins in a short window can
  get you temporarily blocked.

## Moving to the official API

The data layer is isolated behind `src/lib/garmin/endpoints.ts`. Once you have
Developer Program access, implement the same function signatures against the
official Health/Activity API and the pages and API routes are unchanged. The
OAuth1 signer in `oauth1.ts` is reusable — the official API uses OAuth 1.0a too.
