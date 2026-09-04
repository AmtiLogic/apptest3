import { strict as assert } from "node:assert";
import { test } from "node:test";
import { envOr } from "./env.ts";

test("envOr falls back for unset, empty and whitespace values", () => {
  assert.equal(envOr(undefined, "garmin.com"), "garmin.com");
  assert.equal(envOr("", "garmin.com"), "garmin.com");
  assert.equal(envOr("   ", "garmin.com"), "garmin.com");
});

test("envOr uses a real value, trimmed", () => {
  assert.equal(envOr("garmin.cn", "garmin.com"), "garmin.cn");
  assert.equal(envOr("  garmin.cn  ", "garmin.com"), "garmin.cn");
});
