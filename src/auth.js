const authDomain = "https://login.yotoplay.com/oauth";
const audience = "https://api.yotoplay.com";

async function requestToken(path, values, request = fetch) {
  const response = await request(`${authDomain}/${path}`, {
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
  return requestToken("device/code", {
    client_id: clientId,
    scope: "offline_access",
    audience,
  }, request);
}

export async function waitForAuthorization(clientId, device, request = fetch, sleep = setTimeout) {
  const deadline = Date.now() + (device.expires_in * 1000);
  let interval = (device.interval || 5) * 1000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => sleep(resolve, interval));
    try {
      return await requestToken("token", {
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: device.device_code,
        client_id: clientId,
      }, request);
    } catch (error) {
      if (error.code === "authorization_pending") continue;
      if (error.code === "slow_down") {
        interval += 5000;
        continue;
      }
      throw error;
    }
  }
  throw new Error("Yoto login expired before authorization completed.");
}

export async function validTokens(auth, request = fetch) {
  if (!auth?.accessToken) throw new Error("Run `yoto-sync login` first.");
  if (Date.now() < auth.expiresAt - 60_000) return auth;
  if (!auth.refreshToken) throw new Error("Yoto login expired; run `yoto-sync login` again.");

  const refreshed = await requestToken("token", {
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
