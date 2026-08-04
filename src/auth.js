const authDomain = "https://login.yotoplay.com";
const audience = "https://api.yotoplay.com";
const scope = "openid profile email family:library:manage user:content:manage offline_access";
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

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

export async function startDeviceAuthorization(clientId, request = fetch) {
  const response = await request(`${authDomain}/oauth/device/code`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
    audience,
    scope,
    client_id: clientId,
    }),
  });
  const device = await response.json();
  if (!response.ok) throw new Error(device.error_description || device.error || "Yoto device authorization failed.");
  if (!device.device_code || !device.user_code || !(device.verification_uri_complete || device.verification_uri)) {
    throw new Error("Yoto returned an invalid device authorization.");
  }
  return device;
}

export async function waitForDeviceAuthorization(clientId, device, request = fetch, pause = sleep) {
  const deadline = Date.now() + (Number(device.expires_in) * 1000);
  let interval = Number(device.interval || 5) * 1000;
  while (Date.now() < deadline) {
    await pause(interval);
    const response = await requestToken({
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      client_id: clientId,
      device_code: device.device_code,
    }, request).catch((error) => error);
    if (!(response instanceof Error)) return response;
    if (response.code === "authorization_pending") continue;
    if (response.code === "slow_down") {
      interval += 5000;
      continue;
    }
    if (response.code === "access_denied") throw new Error("Yoto authorization was denied.");
    if (response.code === "expired_token") throw new Error("Yoto device code expired; run `yoto-sync login` again.");
    throw response;
  }
  throw new Error("Yoto device code expired; run `yoto-sync login` again.");
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
