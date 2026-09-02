/**
 * Minimal cookie jar. The login flow only ever talks to *.garmin.com, so
 * cookies are stored per top-level domain rather than with full path/expiry
 * semantics.
 */
export class CookieJar {
  private jar = new Map<string, string>();

  absorb(response: Response): void {
    for (const raw of response.headers.getSetCookie()) {
      const [pair] = raw.split(";");
      const eq = pair.indexOf("=");
      if (eq <= 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      // An empty value is how a server clears a cookie.
      if (value === "" || value === '""') this.jar.delete(name);
      else this.jar.set(name, value);
    }
  }

  header(): string {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  get size(): number {
    return this.jar.size;
  }
}
