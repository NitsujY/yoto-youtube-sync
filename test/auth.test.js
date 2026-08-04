import assert from "node:assert/strict";
import test from "node:test";
import { startDeviceAuthorization, waitForDeviceAuthorization } from "../src/auth.js";

test("device authorization requests an offline token for the Yoto API", async () => {
  let request;
  const device = await startDeviceAuthorization("client-id", async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({
      device_code: "device-code",
      user_code: "ABCD-EFGH",
      verification_uri: "https://login.yotoplay.com/activate",
    }), { status: 200 });
  });

  assert.equal(request.url, "https://login.yotoplay.com/oauth/device/code");
  assert.equal(request.options.body.toString(), "audience=https%3A%2F%2Fapi.yotoplay.com&scope=openid+profile+email+family%3Alibrary%3Amanage+user%3Acontent%3Amanage+offline_access&client_id=client-id");
  assert.equal(device.user_code, "ABCD-EFGH");
});

test("device authorization polls until Yoto returns tokens", async () => {
  let request;
  const result = await waitForDeviceAuthorization("client-id", {
    device_code: "device-code",
    user_code: "ABCD-EFGH",
    verification_uri: "https://login.yotoplay.com/activate",
    expires_in: 60,
    interval: 0,
  }, async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ access_token: "access", refresh_token: "refresh", expires_in: 3600 }), { status: 200 });
  }, async () => {});

  assert.equal(request.url, "https://login.yotoplay.com/oauth/token");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.body.toString(), "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code&client_id=client-id&device_code=device-code");
  assert.equal(result.access_token, "access");
});
