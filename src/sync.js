export async function syncProfile(profile, knownIds, services, options = {}) {
  const tracks = [];
  for (const source of profile.sources) {
    tracks.push(...await services.listTracks(source, options.limit));
  }

  const pending = tracks.filter((track) => options.force || !knownIds.has(track.id));
  await options.onDetected?.(tracks, pending);
  if (options.dryRun) return { found: tracks.length, pending, uploaded: [], removed: [] };

  const uploaded = [];
  const removed = [];
  for (const track of pending) {
    await options.onUpdating?.(track);
    let path;
    try {
      console.log(`Downloading: ${track.title}`);
      path = await services.downloadTrack(track);
      console.log(`Downloaded: ${track.title}`);
    } catch (error) {
      if (!(error instanceof Error) || !/video is not available|private video|members-only/i.test(error.message)) throw error;
      console.warn(`Skipping unavailable video: ${track.title}`);
      continue;
    }
    try {
      const mediaUrl = await services.uploadTrack(path);
      const evicted = await services.addTrackToCard(profile.cardId, track, mediaUrl, options.maxStories);
      const removedTracks = Array.isArray(evicted) ? evicted : [];
      for (const oldTrack of removedTracks) knownIds.delete(oldTrack.id);
      removed.push(...removedTracks);
      knownIds.add(track.id);
      uploaded.push(track);
      await options.onUploaded?.(knownIds, track);
      if (removedTracks.length) await options.onRemoved?.(removedTracks);
    } finally {
      await services.removeDownload(path);
    }
  }
  return { found: tracks.length, pending, uploaded, removed };
}
