import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createYotoSdk } from "@yotoplay/yoto-sdk";

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function createYoto(token) {
  if (!token) throw new Error("Run `yoto-sync login` first.");
  return createYotoSdk({ jwt: token });
}

export async function listCards(yoto) {
  return yoto.content.getMyCards();
}

export async function uploadTrack(yoto, path) {
  const audio = await readFile(path);
  const sha256 = createHash("sha256").update(audio).digest("hex");
  const upload = await yoto.media.getUploadUrlForTranscode(sha256, "track.mp3");
  await yoto.media.uploadFile(upload.uploadUrl, audio);

  for (let attempt = 0; attempt < 120; attempt += 1) {
    const transcode = await yoto.media.getTranscodedUpload(upload.uploadId, true);
    if (transcode.status === "complete" && transcode.url) return transcode.url;
    if (transcode.status === "failed") throw new Error("Yoto could not transcode the uploaded audio.");
    await sleep(1500);
  }
  throw new Error("Timed out waiting for Yoto to transcode the uploaded audio.");
}

export async function addTrackToCard(yoto, cardId, track, mediaUrl) {
  const card = await yoto.content.getCard(cardId);
  const chapters = Array.isArray(card.content?.chapters) ? card.content.chapters : [];
  const chapter = {
    title: track.title,
    key: track.id,
    tracks: [{
      title: track.title,
      key: track.id,
      trackUrl: mediaUrl,
      duration: track.duration,
      format: "aac",
      type: "audio",
    }],
  };

  await yoto.content.updateCard({
    ...card,
    cardId,
    content: { ...card.content, chapters: [...chapters, chapter] },
  });
}
