import assert from "node:assert/strict";
import test from "node:test";
import { startDeviceAuthorization } from "../src/auth.js";

test("device authorization requests an offline token for the Yoto API", async () => {
  let request;
  const result = await startDeviceAuthorization("client-id", async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ device_code: "device", user_code: "CODE" }), { status: 200 });
  });

  assert.equal(request.url, "https://login.yotoplay.com/oauth/device/code");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.body.toString(), "client_id=client-id&scope=offline_access&audience=https%3A%2F%2Fapi.yotoplay.com");
  assert.equal(result.user_code, "CODE");
});
