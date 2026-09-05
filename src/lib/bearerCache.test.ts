import { strict as assert } from "node:assert";
import { test } from "node:test";
import { _resetBearerCache, bearerFor, cacheBearer, cachedBearer, dropBearer } from "./bearerCache.ts";
import type { OAuth1Token, OAuth2Token } from "./garmin/types.ts";

const oauth1 = (token = "token-a"): OAuth1Token => ({
  oauthToken: token,
  oauthTokenSecret: "secret",
  domain: "garmin.com",
});

const oauth2 = (expiresInMs = 3_600_000): OAuth2Token => ({
  accessToken: "bearer",
  refreshToken: "refresh",
  tokenType: "Bearer",
  expiresAt: Date.now() + expiresInMs,
});

test("a cached token is returned without exchanging", async () => {
  _resetBearerCache();
  cacheBearer(oauth1(), oauth2());

  let calls = 0;
  await bearerFor(oauth1(), async () => {
    calls += 1;
    return oauth2();
  });
  assert.equal(calls, 0);
});

test("an expired token is discarded rather than served", () => {
  _resetBearerCache();
  // Inside the refresh margin, so it must not be handed out.
  cacheBearer(oauth1(), oauth2(30_000));
  assert.equal(cachedBearer(oauth1()), null);
});

test("simultaneous callers share a single exchange", async () => {
  _resetBearerCache();

  let calls = 0;
  const exchange = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 25));
    return oauth2();
  };

  // The case that matters: a cold instance serving several requests at once.
  const results = await Promise.all(Array.from({ length: 8 }, () => bearerFor(oauth1(), exchange)));

  assert.equal(calls, 1, "expected one exchange for eight concurrent callers");
  assert.ok(results.every((r) => r.accessToken === "bearer"));
});

test("different tokens do not share an exchange", async () => {
  _resetBearerCache();
  let calls = 0;
  const exchange = async () => {
    calls += 1;
    return oauth2();
  };
  await Promise.all([bearerFor(oauth1("a"), exchange), bearerFor(oauth1("b"), exchange)]);
  assert.equal(calls, 2);
});

test("a failed exchange is not cached and does not wedge later attempts", async () => {
  _resetBearerCache();

  let calls = 0;
  const failing = async () => {
    calls += 1;
    throw new Error("Garmin refused the token exchange (HTTP 429)");
  };

  await assert.rejects(bearerFor(oauth1(), failing), /429/);
  // The in-flight entry must be cleared, so a retry actually retries.
  await assert.rejects(bearerFor(oauth1(), failing), /429/);
  assert.equal(calls, 2);

  const ok = await bearerFor(oauth1(), async () => oauth2());
  assert.equal(ok.accessToken, "bearer");
});

test("dropBearer forgets a token", () => {
  _resetBearerCache();
  cacheBearer(oauth1(), oauth2());
  assert.ok(cachedBearer(oauth1()));
  dropBearer(oauth1());
  assert.equal(cachedBearer(oauth1()), null);
});
