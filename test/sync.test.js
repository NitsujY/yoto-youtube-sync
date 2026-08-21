import assert from "node:assert/strict";
import test from "node:test";
import { syncProfile } from "../src/sync.js";

test("sync uploads only tracks not already in state", async () => {
  const calls = [];
  const listed = [];
  const services = {
    listTracks: async (url, limit) => {
      listed.push({ url, limit });
      return [{ id: "old", title: "Old" }, { id: "new", title: "New" }];
    },
    downloadTrack: async (track) => `${track.id}.mp3`,
    uploadTrack: async (path) => `yoto:#${path}`,
    addTrackToCard: async (cardId, track, mediaUrl) => calls.push({ cardId, track, mediaUrl }),
    removeDownload: async () => {},
  };
  const knownIds = new Set(["old"]);

  const result = await syncProfile({ cardId: "card-1", sources: ["https://youtube.com/playlist"] }, knownIds, services, { limit: 10 });

  assert.deepEqual(result.uploaded.map((track) => track.id), ["new"]);
  assert.deepEqual(listed, [{ url: "https://youtube.com/playlist", limit: 10 }]);
  assert.deepEqual(calls, [{ cardId: "card-1", track: { id: "new", title: "New", fileSize: 0 }, mediaUrl: "yoto:#new.mp3" }]);
  assert.deepEqual([...knownIds], ["old", "new"]);
});

test("sync retries unavailable videos on later runs", async () => {
  const knownIds = new Set();
  const result = await syncProfile(
    { cardId: "card-1", sources: ["https://youtube.com/playlist"] },
    knownIds,
    {
      listTracks: async () => [{ id: "gone", title: "Gone" }],
      downloadTrack: async () => { throw new Error("yt-dlp failed: This video is not available"); },
    },
  );

  assert.deepEqual(result.uploaded, []);
  assert.deepEqual([...knownIds], []);
});

test("sync sorts tracks by timestamp so max-stories keeps the newest", async () => {
  const calls = [];
  const services = {
    listTracks: async () => [
      { id: "new", title: "New", timestamp: 2000 },
      { id: "old", title: "Old", timestamp: 1000 },
    ],
    downloadTrack: async (track) => `${track.id}.mp3`,
    uploadTrack: async (path) => `yoto:#${path}`,
    addTrackToCard: async (cardId, track) => { calls.push(track.id); return []; },
    removeDownload: async () => {},
  };

  await syncProfile({ cardId: "card-1", sources: ["https://youtube.com/playlist"] }, new Set(), services);

  assert.deepEqual(calls, ["old", "new"]);
});

test("sync only processes the latest max-stories tracks", async () => {
  const calls = [];
  const services = {
    listTracks: async () => [
      { id: "old", title: "Old", timestamp: 1000 },
      { id: "new", title: "New", timestamp: 2000 },
    ],
    downloadTrack: async (track) => `${track.id}.mp3`,
    uploadTrack: async (path) => `yoto:#${path}`,
    addTrackToCard: async (cardId, track) => { calls.push(track.id); return []; },
    removeDownload: async () => {},
  };

  const result = await syncProfile({ cardId: "card-1", sources: ["https://youtube.com/playlist"] }, new Set(), services, { maxStories: 1 });

  assert.equal(result.found, 1);
  assert.deepEqual(result.target.map((track) => track.id), ["new"]);
  assert.deepEqual(calls, ["new"]);
});

test("sync removes evicted stories from state", async () => {
  const knownIds = new Set(["old"]);
  const result = await syncProfile(
    { cardId: "card-1", sources: ["https://youtube.com/playlist"] },
    knownIds,
    {
      listTracks: async () => [{ id: "new", title: "New" }],
      downloadTrack: async () => "new.mp3",
      uploadTrack: async () => "yoto:#new.mp3",
      addTrackToCard: async () => [{ id: "old", title: "Old" }],
      removeDownload: async () => {},
    },
  );

  assert.deepEqual(result.removed, [{ id: "old", title: "Old" }]);
  assert.deepEqual([...knownIds], ["new"]);
});

test("sync fetches only the newest max-stories entries by default", async () => {
  const listed = [];
  const probed = [];
  const services = {
    probeTrackIds: async (url, limit) => { probed.push(limit); return ["new"]; },
    listTracks: async (url, limit) => { listed.push(limit); return [{ id: "new", title: "New", timestamp: 1 }]; },
    downloadTrack: async () => "new.mp3",
    uploadTrack: async () => "yoto:#new.mp3",
    addTrackToCard: async () => [],
    removeDownload: async () => {},
  };

  await syncProfile({ cardId: "c", sources: ["https://youtube.com/@x/videos"] }, new Set(), services, { maxStories: 5 });

  assert.deepEqual(probed, [5]);
  assert.deepEqual(listed, [5]);
});

test("sync filters tracks by title case-insensitively without starving maxStories fetch", async () => {
  const listed = [];
  const calls = [];
  const services = {
    listTracks: async (url, limit) => {
      listed.push(limit);
      return [
        { id: "1", title: "EP 1", timestamp: 1000 },
        { id: "2", title: "Trailer", timestamp: 2000 },
        { id: "3", title: "EP 2", timestamp: 3000 },
      ];
    },
    downloadTrack: async (track) => `${track.id}.mp3`,
    uploadTrack: async (path) => `yoto:#${path}`,
    addTrackToCard: async (cardId, track) => { calls.push(track.id); return []; },
    removeDownload: async () => {},
  };

  const result = await syncProfile({ cardId: "card-1", sources: ["https://youtube.com/playlist"] }, new Set(), services, { filter: "EP", maxStories: 2 });

  assert.equal(listed[0], undefined);
  assert.equal(result.found, 2);
  assert.deepEqual(result.target.map((track) => track.id), ["1", "3"]);
  assert.deepEqual(calls, ["1", "3"]);
});
