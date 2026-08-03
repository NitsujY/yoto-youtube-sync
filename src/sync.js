export async function syncProfile(profile, knownIds, services, options = {}) {
  const tracks = [];
  for (const source of profile.sources) {
    tracks.push(...await services.listTracks(source, options.limit));
  }

  const pending = tracks.filter((track) => options.force || !knownIds.has(track.id));
  if (options.dryRun) return { found: tracks.length, uploaded: [] };

  const uploaded = [];
  for (const track of pending) {
    let path;
    try {
      path = await services.downloadTrack(track);
    } catch (error) {
      if (!(error instanceof Error) || !/video is not available|private video|members-only/i.test(error.message)) throw error;
      console.warn(`Skipping unavailable video: ${track.title}`);
      knownIds.add(track.id);
      await options.onUploaded?.(knownIds);
      continue;
    }
    try {
      const mediaUrl = await services.uploadTrack(path);
      await services.addTrackToCard(profile.cardId, track, mediaUrl);
      knownIds.add(track.id);
      uploaded.push(track);
      await options.onUploaded?.(knownIds);
    } finally {
      await services.removeDownload(path);
    }
  }
  return { found: tracks.length, uploaded };
}
