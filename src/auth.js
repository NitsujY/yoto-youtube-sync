import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";

const authDomain = "https://login.yotoplay.com";
const audience = "https://api.yotoplay.com";
const scope = "family:library:manage family:library:view family:devices:view user:content:manage user:content:view offline_access";
export const redirectUri = "http://127.0.0.1:8787/callback";

async function requestToken(values, request = fetch) {
  const response = await request(`${authDomain}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(values),
  });
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.error_description || body.error || "Yoto authentication failed.");
    error.code = body.error;
    throw error;
  }
  return body;
}

function base64Url(value) {
  return value.toString("base64url");
}

export function startAuthorization(clientId, redirect = redirectUri, state) {
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  const url = new URL(`${authDomain}/authorize`);
  url.search = new URLSearchParams({
    audience,
    scope,
    response_type: "code",
    client_id: clientId,
    code_challenge: challenge,
    code_challenge_method: "S256",
    redirect_uri: redirect,
    ...(state && { state }),
  }).toString();
  return { verifier, url: url.toString() };
}

export function waitForAuthorizationCode() {
  return new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      const url = new URL(request.url, redirectUri);
      if (url.pathname !== "/callback") {
        response.writeHead(404).end();
        return;
      }
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end("<p>Yoto login complete. You can close this tab.</p>");
      server.close();
      if (error) reject(new Error(`Yoto login failed: ${error}`));
      else if (code) resolve(code);
      else reject(new Error("Yoto login returned no authorization code."));
    });
    server.once("error", reject);
    server.listen(8787, "127.0.0.1");
  });
}

export function exchangeAuthorizationCode(clientId, code, verifier, redirect = redirectUri, request = fetch) {
  return requestToken({
    grant_type: "authorization_code",
    client_id: clientId,
    code_verifier: verifier,
    code,
    redirect_uri: redirect,
  }, request);
}

export async function validTokens(auth, request = fetch) {
  if (!auth?.accessToken) throw new Error("Run `yoto-sync login` first.");
  if (Date.now() < auth.expiresAt - 60_000) return auth;
  if (!auth.refreshToken) throw new Error("Yoto login expired; run `yoto-sync login` again.");

  const refreshed = await requestToken({
    grant_type: "refresh_token",
    refresh_token: auth.refreshToken,
    client_id: auth.clientId,
  }, request);
  return {
    ...auth,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token || auth.refreshToken,
    expiresAt: Date.now() + (refreshed.expires_in * 1000),
  };
}

export function savedTokens(clientId, tokens) {
  return {
    clientId,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + (tokens.expires_in * 1000),
  };
}
