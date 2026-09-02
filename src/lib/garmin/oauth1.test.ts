import { strict as assert } from "node:assert";
import { test } from "node:test";
import { authorizationHeader, normaliseParameters, percentEncode, sign, signatureBaseString } from "./oauth1";

test("percentEncode escapes characters encodeURIComponent leaves alone", () => {
  assert.equal(percentEncode("a!b*c'd(e)f"), "a%21b%2Ac%27d%28e%29f");
  assert.equal(percentEncode("Hello Ladies + Gentlemen, a signed OAuth request!"),
    "Hello%20Ladies%20%2B%20Gentlemen%2C%20a%20signed%20OAuth%20request%21");
  assert.equal(percentEncode("-._~"), "-._~");
});

test("normaliseParameters sorts by encoded key then encoded value", () => {
  assert.equal(
    normaliseParameters([["b", "2"], ["a", "z"], ["a", "a"]]),
    "a=a&a=z&b=2",
  );
});

// RFC 5849 section 3.4.1.1 worked example.
test("signatureBaseString matches the RFC 5849 example", () => {
  const base = signatureBaseString(
    "POST",
    "http://example.com/request?b5=%3D%253D&a3=a&c%40=&a2=r%20b",
    [
      ["c2", ""],
      ["a3", "2 q"],
      ["oauth_consumer_key", "9djdj82h48djs9d2"],
      ["oauth_token", "kkk9d7dh3k39sjv7"],
      ["oauth_signature_method", "HMAC-SHA1"],
      ["oauth_timestamp", "137131201"],
      ["oauth_nonce", "7d8f3e4a"],
    ],
  );
  assert.equal(
    base,
    "POST&http%3A%2F%2Fexample.com%2Frequest&a2%3Dr%2520b%26a3%3D2%2520q%26a3%3D" +
      "a%26b5%3D%253D%25253D%26c%2540%3D%26c2%3D%26oauth_consumer_key%3D9djdj82h4" +
      "8djs9d2%26oauth_nonce%3D7d8f3e4a%26oauth_signature_method%3DHMAC-SHA1%26oa" +
      "uth_timestamp%3D137131201%26oauth_token%3Dkkk9d7dh3k39sjv7",
  );
});

// Cross-checked against an independent implementation:
//   printf 'GET&https%%3A%%2F%%2Fexample.com%%2F&a%%3D1' \
//     | openssl dgst -sha1 -hmac 'cs%26sec&tok%2Bsec' -binary | base64
// The secrets are chosen so that the signing key exercises percent-encoding.
test("sign matches an independent HMAC-SHA1 reference", () => {
  assert.equal(
    sign("GET&https%3A%2F%2Fexample.com%2F&a%3D1", "cs&sec", "tok+sec"),
    "S2bqVVLnnmr8vyGgOc5bVqM4Mo4=",
  );
});

test("sign uses an empty token secret when the token is absent", () => {
  assert.equal(
    sign("GET&https%3A%2F%2Fexample.com%2F&a%3D1", "cs&sec"),
    sign("GET&https%3A%2F%2Fexample.com%2F&a%3D1", "cs&sec", ""),
  );
});

// The base string below is the one published in Twitter's "Creating a
// signature" guide. Asserting that authorizationHeader signs byte-for-byte the
// same string proves it assembles query params, body params and oauth params
// exactly as a documented implementation does.
test("authorizationHeader reproduces a documented signature base string", () => {
  const documentedBaseString =
    "POST&https%3A%2F%2Fapi.twitter.com%2F1%2Fstatuses%2Fupdate.json&include_entities" +
    "%3Dtrue%26oauth_consumer_key%3Dxvz1evFS4wEEPTGEFPHBog%26oauth_nonce%3DkYjzVBB8Y0" +
    "ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg%26oauth_signature_method%3DHMAC-SHA1%26oauth_ti" +
    "mestamp%3D1318622958%26oauth_token%3D370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS" +
    "9weJAEb%26oauth_version%3D1.0%26status%3DHello%2520Ladies%2520%252B%2520Gentleme" +
    "n%252C%2520a%2520signed%2520OAuth%2520request%2521";

  const creds = {
    consumerKey: "xvz1evFS4wEEPTGEFPHBog",
    consumerSecret: "kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw",
    token: "370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb",
    tokenSecret: "LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE",
  };

  const header = authorizationHeader(
    "POST",
    "https://api.twitter.com/1/statuses/update.json?include_entities=true",
    creds,
    [["status", "Hello Ladies + Gentlemen, a signed OAuth request!"]],
    "kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg",
    "1318622958",
  );

  const expected = percentEncode(sign(documentedBaseString, creds.consumerSecret, creds.tokenSecret));
  assert.match(header, /^OAuth /);
  assert.ok(header.includes(`oauth_signature="${expected}"`), header);
  assert.ok(header.includes('oauth_consumer_key="xvz1evFS4wEEPTGEFPHBog"'));
  assert.ok(header.includes('oauth_version="1.0"'));
});

test("body parameters are folded into the signature", () => {
  const withBody = authorizationHeader("POST", "https://example.com/x", { consumerKey: "k", consumerSecret: "s" }, [["a", "1"]], "n", "1");
  const withoutBody = authorizationHeader("POST", "https://example.com/x", { consumerKey: "k", consumerSecret: "s" }, [], "n", "1");
  assert.notEqual(withBody, withoutBody);
});
