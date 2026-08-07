import assert from "node:assert/strict";
import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";
import { addTrackToCard, listCardTrackIds, uploadTrack } from "../src/yoto.js";

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

test("uploadTrack uploads to the SDK's URL field", async () => {
  const path = join(tmpdir(), `yoto-${Date.now()}.mp3`);
  await writeFile(path, "audio");
  let uploaded = false;
  const yoto = {
    media: {
      getUploadUrlForTranscode: async (_, filename) => {
        assert.equal(filename, basename(path));
        return { uploadId: "upload-1", url: "https://upload.example/track" };
      },
      uploadFile: async (url) => {
        assert.equal(url, "https://upload.example/track");
        uploaded = true;
      },
      getTranscodedUpload: async () => ({ status: "complete", url: "https://media.example/track" }),
    },
  };

  try {
    await uploadTrack(yoto, path);
    assert.equal(uploaded, true);
  } finally {
    await rm(path);
  }
});

test("addTrackToCard keeps the newest 20 stories", async () => {
  let updated;
  const chapters = Array.from({ length: 20 }, (_, index) => ({ key: `old-${index + 1}`, title: `Old ${index + 1}` }));
  const yoto = {
    content: {
      getMyCards: async () => [{ cardId: "card-1", content: { chapters } }],
      updateCard: async (card) => { updated = card; },
    },
  };

  const removed = await addTrackToCard(yoto, "card-1", { id: "new", title: "New", duration: 10 }, "https://media.example/new");

  assert.deepEqual(removed, [{ id: "old-1", title: "Old 1" }]);
  assert.equal(updated.content.chapters.length, 20);
  assert.equal(updated.content.chapters[0].key, "old-2");
  assert.equal(updated.content.chapters.at(-1).key, "new");
});

test("listCardTrackIds reads existing chapter keys", async () => {
  const ids = await listCardTrackIds({
    content: {
      getMyCards: async () => [{ cardId: "card-1", content: { chapters: [{ key: "old" }, { title: "Untitled" }, { key: "new" }] } }],
    },
  }, "card-1");

  assert.deepEqual(ids, ["old", "new"]);
});
