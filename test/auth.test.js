import assert from "node:assert/strict";
import test from "node:test";
import { exchangeAuthorizationCode, redirectUri, startAuthorization } from "../src/auth.js";

test("PKCE authorization requests an offline token for the Yoto API", () => {
  const authorization = startAuthorization("client-id");
  const url = new URL(authorization.url);

  assert.equal(url.origin, "https://login.yotoplay.com");
  assert.equal(url.pathname, "/authorize");
  assert.equal(url.searchParams.get("client_id"), "client-id");
  assert.equal(url.searchParams.get("audience"), "https://api.yotoplay.com");
  assert.equal(url.searchParams.get("scope"), "family:library:manage family:library:view family:devices:view user:content:manage user:content:view offline_access");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("redirect_uri"), redirectUri);
  assert.ok(authorization.verifier);
  assert.ok(url.searchParams.get("code_challenge"));
});

test("authorization code exchange sends the PKCE verifier", async () => {
  let request;
  const result = await exchangeAuthorizationCode("client-id", "code", "verifier", redirectUri, async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ access_token: "access", refresh_token: "refresh", expires_in: 3600 }), { status: 200 });
  });

  assert.equal(request.url, "https://login.yotoplay.com/oauth/token");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.body.toString(), "grant_type=authorization_code&client_id=client-id&code_verifier=verifier&code=code&redirect_uri=http%3A%2F%2F127.0.0.1%3A8787%2Fcallback");
  assert.equal(result.access_token, "access");
});

test("HTTPS authorization includes state and uses the registered callback", () => {
  const authorization = startAuthorization("client-id", "https://windmill.example/callback", "state");
  const url = new URL(authorization.url);

  assert.equal(url.searchParams.get("redirect_uri"), "https://windmill.example/callback");
  assert.equal(url.searchParams.get("state"), "state");
});
