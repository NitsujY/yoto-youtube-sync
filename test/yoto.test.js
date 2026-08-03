import assert from "node:assert/strict";
import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { uploadTrack } from "../src/yoto.js";

test("uploadTrack resumes an existing Yoto transcode", async () => {
  const path = join(tmpdir(), `yoto-${Date.now()}.mp3`);
  await writeFile(path, "audio");
  const yoto = {
    media: {
      getUploadUrlForTranscode: async () => ({ uploadId: "upload-1" }),
      uploadFile: async () => assert.fail("existing upload must not be uploaded again"),
      getTranscodedUpload: async () => ({ status: "complete", url: "https://media.example/track" }),
    },
  };

  try {
    assert.equal(await uploadTrack(yoto, path), "https://media.example/track");
  } finally {
    await rm(path);
  }
});
