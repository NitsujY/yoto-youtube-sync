export async function syncProfile(profile, knownIds, services, options = {}) {
  const tracks = [];
  for (const source of profile.sources) {
    tracks.push(...await services.listTracks(source));
  }

  const pending = tracks.filter((track) => options.force || !knownIds.has(track.id));
  if (options.dryRun) return { found: tracks.length, uploaded: [] };

  const uploaded = [];
  for (const track of pending) {
    const path = await services.downloadTrack(track);
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
