import { strict as assert } from "node:assert";
import { test } from "node:test";
import { seal, unseal } from "./crypto-cookie.ts";

// The module reads APP_SECRET lazily on each call, so setting it here (after the
// hoisted import) is enough, and rotating it mid-test is meaningful.
const SECRET = "test-secret-value-at-least-32-chars-long";
process.env.APP_SECRET = SECRET;

test("seal/unseal round-trips a payload", () => {
  const payload = { oauth1: { oauthToken: "t", oauthTokenSecret: "s", domain: "garmin.com" } };
  assert.deepEqual(unseal(seal(payload)), payload);
});

test("sealed values are opaque and differ each time", () => {
  const sealed = seal({ oauthToken: "super-secret-token" });
  assert.ok(!sealed.includes("super-secret-token"));
  // A fresh IV per seal, so the same payload never produces the same ciphertext.
  assert.notEqual(sealed, seal({ oauthToken: "super-secret-token" }));
});

test("unseal rejects tampered ciphertext", () => {
  const sealed = seal({ admin: false });
  const flipped = sealed.slice(0, -4) + (sealed.slice(-4) === "AAAA" ? "BBBB" : "AAAA");
  assert.equal(unseal(flipped), null);
});

test("unseal rejects truncated, empty and malformed values", () => {
  assert.equal(unseal(seal({ a: 1 }).slice(0, 10)), null);
  assert.equal(unseal(""), null);
  assert.equal(unseal(undefined), null);
  assert.equal(unseal("not-base64url-at-all!!"), null);
});

test("unseal rejects a value sealed with a different secret", () => {
  const sealed = seal({ a: 1 });
  process.env.APP_SECRET = "a-completely-different-secret-value-32";
  assert.equal(unseal(sealed), null);
  process.env.APP_SECRET = SECRET;
  assert.deepEqual(unseal(sealed), { a: 1 });
});

test("production refuses to run without APP_SECRET", () => {
  const previousEnv = process.env.NODE_ENV;
  delete process.env.APP_SECRET;
  process.env.NODE_ENV = "production";
  try {
    assert.throws(() => seal({ a: 1 }), /APP_SECRET must be set/);
  } finally {
    process.env.NODE_ENV = previousEnv;
    process.env.APP_SECRET = SECRET;
  }
});
