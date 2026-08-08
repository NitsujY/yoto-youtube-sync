import { mkdir, rename, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

function parseUploadDate(value) {
  if (!value || typeof value !== "string" || value.length !== 8) return 0;
  return Date.UTC(Number(value.slice(0, 4)), Number(value.slice(4, 6)) - 1, Number(value.slice(6, 8))) / 1000;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => reject(new Error(`Could not run ${command}: ${error.message}`)));
    child.on("close", (code) => {
      if (code === 0) return resolve(stdout);
      reject(new Error(`${command} failed: ${stderr.trim() || `exit ${code}`}`));
    });
  });
}

export async function listTracks(url, limit) {
  let result;
  try {
    const args = ["--js-runtimes", "node", "--flat-playlist", "--dump-single-json", "--no-warnings"];
    if (limit) args.push("--playlist-end", String(limit));
    args.push(url);
    result = JSON.parse(await run("yt-dlp", args));
  } catch (error) {
    throw new Error(`Could not read ${url}: ${error.message}`);
  }

  const entries = result.entries || [result];
  return entries
    .filter((entry) => entry?.id && (entry.webpage_url || entry.url))
    .map((entry) => ({
      id: entry.id,
      title: entry.title || entry.id,
      url: entry.webpage_url || entry.url,
      duration: Number(entry.duration) || 0,
      timestamp: Number(entry.timestamp) || parseUploadDate(entry.upload_date) || 0,
    }));
}

export async function downloadTrack(track) {
  const directory = await mkdir(join(tmpdir(), "yoto-sync"), { recursive: true }).then(() => join(tmpdir(), "yoto-sync"));
  const path = join(directory, `${track.id}.mp3`);
  await run("yt-dlp", ["--js-runtimes", "node", "--extractor-args", "youtube:player_client=android", "--no-playlist", "--no-warnings", "-x", "--audio-format", "mp3", "--output", path, track.url]);
  const taggedPath = `${path}.tagged.mp3`;
  await run("ffmpeg", ["-y", "-i", path, "-map", "0:a", "-c", "copy", "-metadata", "comment=yoto-sync-v2", taggedPath]);
  await rename(taggedPath, path);
  return path;
}

export async function removeDownload(path) {
  await rm(path, { force: true });
}
