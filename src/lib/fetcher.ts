export interface ApiError {
  error: string;
  code?: string;
}

/**
 * Fetches one of this app's API routes. A 401 means the Garmin session is gone,
 * so the caller is sent back to the sign-in page.
 */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  if (res.status === 401) {
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Not signed in");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error((body as ApiError | null)?.error ?? `Request failed (${res.status})`);
  return body as T;
}
