export async function syncProfile(profile, knownIds, services, options = {}) {
  const maxStories = options.maxStories ?? 20;
  const log = options.verbose ? (...messages) => console.log(...messages) : () => {};

  // ponytail: cheap flat probe first — if every source ID is already on the card, skip the slow full fetch.
  // Deliberate ceiling: ordering/removal changes without new IDs are ignored (sync never removes non-evicted tracks anyway).
  if (!options.force && !options.dryRun && services.probeTrackIds) {
    try {
      const probed = [];
      for (const source of profile.sources) {
        probed.push(...await services.probeTrackIds(source, options.limit));
      }
      if (probed.length && probed.every((id) => knownIds.has(id))) {
        log(`[${profile.cardId}] probe: all ${probed.length} source track(s) already on card, skipping full fetch`);
        return { unchanged: true, found: 0, target: [], pending: [], uploaded: [], removed: [] };
      }
    } catch {
      log(`[${profile.cardId}] probe failed, falling back to full fetch`);
    }
  }

  const tracks = [];
  for (const source of profile.sources) {
    tracks.push(...await services.listTracks(source, options.limit, options.verbose));
  }
  tracks.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  const targetTracks = tracks.slice(-maxStories);

  log(`[${profile.cardId}] fetched ${tracks.length} available track(s) from ${profile.sources.length} source(s)`);
  if (tracks.length) {
    const oldest = tracks[0];
    const newest = tracks.at(-1);
    log(`  oldest: ${oldest.title} (${new Date((oldest.timestamp || 0) * 1000).toISOString()})`);
    log(`  newest: ${newest.title} (${new Date((newest.timestamp || 0) * 1000).toISOString()})`);
  }

  const pending = targetTracks.filter((track) => options.force || !knownIds.has(track.id));
  await options.onDetected?.(targetTracks, pending, tracks.length);
  if (options.dryRun) return { found: targetTracks.length, target: targetTracks, pending, uploaded: [], removed: [] };

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
  return { found: targetTracks.length, target: targetTracks, pending, uploaded, removed };
}
