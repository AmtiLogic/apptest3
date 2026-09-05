/**
 * Distinguishes "Garmin has no data for you today" from "Garmin returned
 * something this code does not understand".
 *
 * These endpoints are undocumented, so a response can arrive with HTTP 200 and
 * a shape nothing here recognises. Without this check that looks identical to
 * an empty day: every field reads null and the UI renders dashes with no
 * explanation.
 */

export interface ShapeVerdict {
  ok: boolean;
  /** Set when the response cannot be used. */
  message?: string;
  /** True when the shape was understood but every value was empty. */
  emptyButValid?: boolean;
}

/** Keys are listed in the message so an unexpected shape identifies itself. */
const MAX_KEYS_SHOWN = 14;

export function checkShape(value: unknown, expectedKeys: readonly string[]): ShapeVerdict {
  if (value === null || value === undefined) {
    return { ok: false, message: "Garmin returned an empty response (no body)." };
  }

  if (Array.isArray(value)) {
    return value.length === 0
      ? { ok: false, message: "Garmin returned an empty list." }
      : { ok: true };
  }

  if (typeof value !== "object") {
    return { ok: false, message: `Garmin returned a ${typeof value}, not an object.` };
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);

  if (keys.length === 0) {
    return { ok: false, message: "Garmin returned an empty object." };
  }

  const present = expectedKeys.filter((key) => key in record);

  if (present.length === 0) {
    return {
      ok: false,
      message:
        `Garmin returned an object with none of the expected fields. ` +
        `Expected any of: ${expectedKeys.slice(0, 6).join(", ")}. ` +
        `Got: ${keys.slice(0, MAX_KEYS_SHOWN).join(", ")}${keys.length > MAX_KEYS_SHOWN ? `, …(${keys.length} total)` : ""}.`,
    };
  }

  // The shape is right; the day may simply have nothing recorded yet.
  const anyValue = present.some((key) => record[key] !== null && record[key] !== undefined);
  return anyValue ? { ok: true } : { ok: true, emptyButValid: true };
}

/** Fields that must be recognisable for each section to be usable. */
export const EXPECTED = {
  daily: [
    "totalSteps",
    "totalKilocalories",
    "totalDistanceMeters",
    "restingHeartRate",
    "dailyStepGoal",
    "bodyBatteryMostRecentValue",
    "activeSeconds",
    "calendarDate",
  ],
  sleep: ["dailySleepDTO"],
} as const;
