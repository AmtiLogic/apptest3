/**
 * Cookie names live apart from the session store so the edge middleware can
 * import them without pulling in Node-only modules.
 */
export const SESSION_COOKIE = "gcs";
export const MFA_COOKIE = "gcm";
