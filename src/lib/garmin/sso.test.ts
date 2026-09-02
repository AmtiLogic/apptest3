import { strict as assert } from "node:assert";
import { test } from "node:test";
import { CookieJar } from "./cookies.ts";
import { extractCsrfToken, extractTicket, extractTitle } from "./sso.ts";

test("extractCsrfToken pulls the hidden form field", () => {
  const html = '<form><input type="hidden" name="_csrf" value="ABC123DEF" /></form>';
  assert.equal(extractCsrfToken(html), "ABC123DEF");
});

test("extractCsrfToken throws when the field is missing", () => {
  assert.throws(() => extractCsrfToken("<form></form>"), /CSRF/);
});

test("extractTitle reads a title that spans lines", () => {
  assert.equal(extractTitle("<html><head><title>\n  Success\n</title></head></html>"), "Success");
  assert.equal(extractTitle("<title>GARMIN Authentication Application MFA</title>"), "GARMIN Authentication Application MFA");
  assert.equal(extractTitle("<html></html>"), "");
});

test("extractTicket finds the ticket in the embed redirect", () => {
  const html = '<script>window.location = "https://sso.garmin.com/sso/embed?ticket=ST-01-abcXYZ-cas"</script>';
  assert.equal(extractTicket(html), "ST-01-abcXYZ-cas");
});

test("extractTicket throws when login did not produce one", () => {
  assert.throws(() => extractTicket("<html>bad password</html>"), /ticket/);
});

test("CookieJar accumulates, replaces and clears cookies", () => {
  const jar = new CookieJar();

  jar.absorb(
    new Response(null, {
      headers: [
        ["set-cookie", "SESSION=one; Path=/; HttpOnly"],
        ["set-cookie", "CASTGC=two; Secure"],
      ],
    }),
  );
  assert.equal(jar.header(), "SESSION=one; CASTGC=two");

  jar.absorb(new Response(null, { headers: [["set-cookie", "SESSION=three; Path=/"]] }));
  assert.equal(jar.header(), "SESSION=three; CASTGC=two");

  // An empty value is how a server clears a cookie.
  jar.absorb(new Response(null, { headers: [["set-cookie", "CASTGC=; Max-Age=0"]] }));
  assert.equal(jar.header(), "SESSION=three");
  assert.equal(jar.size, 1);
});

test("CookieJar keeps values containing '='", () => {
  const jar = new CookieJar();
  jar.absorb(new Response(null, { headers: [["set-cookie", "TOKEN=abc=def==; Path=/"]] }));
  assert.equal(jar.header(), "TOKEN=abc=def==");
});
