import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { createYotoSdk } from "@yotoplay/yoto-sdk";

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function createYoto(token) {
  if (!token) throw new Error("Run `yoto-sync login` first.");
  return createYotoSdk({ jwt: token });
}

export async function listCards(yoto) {
  return yoto.content.getMyCards();
}

export async function listCardTrackIds(yoto, cardId) {
  return cardTrackIds(await getCard(yoto, cardId));
}

export function cardTrackIds(card) {
  return cardChapters(card).map((chapter) => chapter.key).filter(Boolean);
}

export async function listCardChapters(yoto, cardId) {
  const card = await getCard(yoto, cardId);
  return cardChapters(card);
}

export async function uploadTrack(yoto, path) {
  const audio = await readFile(path);
  const sha256 = createHash("sha256").update(audio).digest("hex");
  console.log(`Yoto upload: requesting URL (${audio.length} bytes)`);
  const upload = await yoto.media.getUploadUrlForTranscode(sha256, basename(path));
  if (!upload.uploadId) throw new Error("Yoto did not return an upload ID.");
  const uploadUrl = upload.uploadUrl || upload.url;
  if (uploadUrl) {
    console.log("Yoto upload: uploading audio");
    await yoto.media.uploadFile(uploadUrl, audio);
    console.log("Yoto upload: upload complete");
  } else {
    console.log("Yoto upload: existing upload found");
  }

  let status;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const transcode = await yoto.media.getTranscodedUpload(upload.uploadId);
    if (attempt === 0 || transcode.status !== status || attempt % 20 === 0) {
      status = transcode.status;
      const progress = transcode.progress;
      const state = status || progress?.phase || "pending";
      const percent = progress?.percent === undefined ? "" : ` ${progress.percent}%`;
      console.log(`Yoto transcode: ${state}${percent} (${attempt * 1.5}s elapsed)`);
    }
    if (transcode.transcodedSha256) return `yoto:#${transcode.transcodedSha256}`;
    // ponytail: transcode.url is a signed/expiring URL — breaks playback later; only a fallback.
    if (transcode.url) return transcode.url;
    if (transcode.status === "failed") throw new Error("Yoto could not transcode the uploaded audio.");
    await sleep(1500);
  }
  throw new Error("Timed out waiting for Yoto to transcode the uploaded audio.");
}

// ponytail: card is fetched once per sync run and mutated locally — re-fetching between adds races Yoto's
// eventually-consistent updateCard and silently drops chapters (server dedupes duplicate keys).
export async function addTrackToCard(yoto, card, track, mediaUrl, maxStories = 20) {
  const chapters = cardChapters(card);
  const chapter = {
    title: track.title,
    key: track.id,
    // ponytail: fields below match Yoto's own zod schema + working MYO cards — the app tolerates their
    // absence, player firmware doesn't. Server recomputes duration/fileSize from the transcoded file.
    overlayLabel: String(chapters.length + 1),
    display: { icon16x16: null },
    hasStreams: false,
    defaultTrackDisplay: null,
    defaultTrackAmbient: null,
    duration: track.duration,
    fileSize: track.fileSize || 0,
    tracks: [{
      title: track.title,
      key: track.id,
      trackUrl: mediaUrl,
      overlayLabel: "1",
      duration: track.duration,
      fileSize: track.fileSize || 0,
      format: "aac",
      type: "audio",
      channels: "stereo",
      display: { icon16x16: null },
      hasStreams: false,
    }],
  };
  const updatedChapters = [...chapters, chapter];
  const removedChapters = updatedChapters.slice(0, -maxStories);

  const kept = updatedChapters.slice(-maxStories);
  await yoto.content.updateCard({
    ...card,
    cardId: card.cardId,
    content: { ...card.content, chapters: kept },
  });
  card.content.chapters = kept;
  return removedChapters
    .filter((chapter) => chapter.key)
    .map((chapter) => ({ id: chapter.key, title: chapter.title || chapter.key }));
}

export async function getCard(yoto, cardId) {
  const card = await yoto.content.getCard(cardId);
  if (!card) throw new Error(`Yoto card ${cardId} was not found.`);
  return card;
}

function cardChapters(card) {
  if (!Array.isArray(card.content?.chapters)) {
    throw new Error(`Yoto card ${card.cardId} did not include chapters; refusing to overwrite its content.`);
  }
  return card.content.chapters;
}
