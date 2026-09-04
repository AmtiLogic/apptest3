import { mockResponse } from "./garmin/mock";

/**
 * True in the GitHub Pages bundle, which has no server behind it.
 *
 * The flag is baked in at build time by `scripts/build-static.mjs`. In this mode
 * the app shows the same fixtures the mock server uses, so the UI is fully
 * browsable, but it cannot reach Garmin -- that needs the Node build.
 */
export const IS_STATIC_DEMO = process.env.NEXT_PUBLIC_STATIC_DEMO === "1";

/** Answers the app's own API paths from local fixtures. */
export function demoResponse(path: string): unknown {
  const [route] = path.split("?");

  if (route.startsWith("/api/garmin/profile")) {
    return mockResponse("/userprofile-service/socialProfile");
  }
  if (route.startsWith("/api/garmin/daily")) {
    return mockResponse("/usersummary-service/usersummary/daily/demo");
  }
  if (route.startsWith("/api/garmin/sleep")) {
    return mockResponse("/wellness-service/wellness/dailySleepData/demo");
  }
  if (route.startsWith("/api/garmin/steps")) {
    return mockResponse("/usersummary-service/stats/steps/daily/a/b");
  }

  // The single-activity route has to be matched before the list route.
  const activity = route.match(/^\/api\/garmin\/activities\/([^/]+)$/);
  if (activity) return mockResponse(`/activity-service/activity/${activity[1]}`);

  if (route.startsWith("/api/garmin/activities")) {
    return mockResponse("/activitylist-service/activities/search/activities");
  }

  return null;
}
