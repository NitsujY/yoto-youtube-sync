import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const configDirectory = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
const stateDirectory = process.env.XDG_STATE_HOME || join(homedir(), ".local", "state");

export const configPath = join(configDirectory, "yoto-sync", "config.json");
export const statePath = join(stateDirectory, "yoto-sync", "state.json");

export async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

export async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporaryPath, path);
  await chmod(path, 0o600);
}

export async function loadConfig() {
  return readJson(configPath, { version: 1, profiles: {} });
}

export async function saveConfig(config) {
  await writeJson(configPath, config);
}

export async function loadState() {
  // ponytail: JSON is enough for per-profile video IDs; use SQLite only for large history/reporting.
  return readJson(statePath, { version: 1, profiles: {} });
}

export async function saveState(state) {
  await writeJson(statePath, state);
}
