import assert from "node:assert/strict";
import test from "node:test";
import { syncProfile } from "../src/sync.js";

test("sync uploads only tracks not already in state", async () => {
  const calls = [];
  const services = {
    listTracks: async () => [{ id: "old", title: "Old" }, { id: "new", title: "New" }],
    downloadTrack: async (track) => `${track.id}.mp3`,
    uploadTrack: async (path) => `yoto:#${path}`,
    addTrackToCard: async (cardId, track, mediaUrl) => calls.push({ cardId, track, mediaUrl }),
    removeDownload: async () => {},
  };
  const knownIds = new Set(["old"]);

  const result = await syncProfile({ cardId: "card-1", sources: ["https://youtube.com/playlist"] }, knownIds, services);

  assert.deepEqual(result.uploaded.map((track) => track.id), ["new"]);
  assert.deepEqual(calls, [{ cardId: "card-1", track: { id: "new", title: "New" }, mediaUrl: "yoto:#new.mp3" }]);
  assert.deepEqual([...knownIds], ["old", "new"]);
});
