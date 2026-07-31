#!/usr/bin/env node
import { parseArgs } from "node:util";
import { loadEnvFile } from "node:process";
import { configPath, loadConfig, loadState, saveConfig, saveState, statePath } from "./storage.js";
import { createYoto, listCards, addTrackToCard, uploadTrack } from "./yoto.js";
import { downloadTrack, listTracks, removeDownload } from "./youtube.js";
import { syncProfile } from "./sync.js";
import { savedTokens, startDeviceAuthorization, validTokens, waitForAuthorization } from "./auth.js";

try {
  loadEnvFile(".env");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const help = `Usage: yoto-sync <command> [options]

Commands:
  init | login                      Authenticate using YOTO_CLIENT_ID from .env
  cards                             List available Yoto cards
  profile add <name> --card <id>    Add a card profile
  profile list | remove <name>      List or remove profiles
  add --profile <name> <url>        Add a YouTube video or playlist
  remove --profile <name> <url>     Remove a source
  sources --profile <name>          List sources
  sync [--profile <name>|--all]     Sync one or all profiles
  status [--profile <name>]         Show configured profiles
  config path | show                Show local configuration

Options: --dry-run, --force, --help, --version`;

function fail(message) {
  throw new Error(message);
}

function profileFor(config, name) {
  const profile = config.profiles[name];
  if (!profile) fail(`Unknown profile: ${name}`);
  return profile;
}

function optionsFor(args) {
  return parseArgs({
    args,
    options: {
      profile: { type: "string" },
      card: { type: "string" },
      all: { type: "boolean" },
      "dry-run": { type: "boolean" },
      force: { type: "boolean" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "V" },
    },
    allowPositionals: true,
  });
}

export async function main(args = process.argv.slice(2), environment = process.env) {
  const { values, positionals } = optionsFor(args);
  const [command, action, value] = positionals;
  if (values.help || !command) return console.log(help);
  if (values.version) return console.log("0.1.0");

  const config = await loadConfig();
  if (command === "init" || command === "login") {
    const clientId = environment.YOTO_CLIENT_ID || config.auth?.clientId;
    if (!clientId) fail("Set YOTO_CLIENT_ID in .env before logging in.");
    const device = await startDeviceAuthorization(clientId);
    console.log(`Open ${device.verification_uri_complete || device.verification_uri} and enter code ${device.user_code}.`);
    const tokens = await waitForAuthorization(clientId, device);
    config.auth = savedTokens(clientId, tokens);
    await saveConfig(config);
    return console.log(`Authenticated. Tokens are saved in ${configPath}`);
  }
  if (command === "config") {
    if (action === "path") return console.log(configPath);
    if (action === "show") return console.log(JSON.stringify({ version: config.version, profiles: config.profiles }, null, 2));
    fail("Use `config path` or `config show`.");
  }
  if (command === "profile") {
    if (action === "list") return console.table(Object.entries(config.profiles).map(([name, profile]) => ({ name, cardId: profile.cardId, sources: profile.sources.length })));
    if (action === "add") {
      if (!value || !values.card) fail("Use `profile add <name> --card <id>`.");
      config.profiles[value] = { cardId: values.card, sources: [] };
      await saveConfig(config);
      return console.log(`Added profile ${value}`);
    }
    if (action === "remove") {
      profileFor(config, value);
      delete config.profiles[value];
      await saveConfig(config);
      return console.log(`Removed profile ${value}`);
    }
    fail("Use `profile add`, `profile list`, or `profile remove`.");
  }
  if (command === "add" || command === "remove" || command === "sources") {
    const profile = profileFor(config, values.profile);
    if (command === "sources") return console.log(profile.sources.join("\n"));
    const url = action;
    if (!url?.startsWith("https://")) fail(`Use \`${command} --profile <name> <https-url>\`.`);
    if (command === "add" && !profile.sources.includes(url)) profile.sources.push(url);
    if (command === "remove") profile.sources = profile.sources.filter((source) => source !== url);
    await saveConfig(config);
    return console.log(`${command === "add" ? "Added" : "Removed"} source.`);
  }
  if (command === "status") {
    const entries = values.profile ? [[values.profile, profileFor(config, values.profile)]] : Object.entries(config.profiles);
    return console.table(entries.map(([name, profile]) => ({ name, cardId: profile.cardId, sources: profile.sources.length })));
  }

  const auth = await validTokens(config.auth);
  if (auth !== config.auth) {
    config.auth = auth;
    await saveConfig(config);
  }
  const yoto = createYoto(auth.accessToken);
  if (command === "cards") return console.table(await listCards(yoto));
  if (command !== "sync") fail(`Unknown command: ${command}`);
  if (values.all && values.profile) fail("Use either --all or --profile, not both.");

  const names = values.profile ? [values.profile] : Object.keys(config.profiles);
  if (!names.length) fail("Add a profile before syncing.");
  const state = await loadState();
  const services = {
    listTracks,
    downloadTrack,
    uploadTrack: (path) => uploadTrack(yoto, path),
    addTrackToCard: (cardId, track, mediaUrl) => addTrackToCard(yoto, cardId, track, mediaUrl),
    removeDownload,
  };
  for (const name of names) {
    const profile = profileFor(config, name);
    const knownIds = new Set(state.profiles[name]?.ids || []);
    const saveProgress = async (ids) => {
      state.profiles[name] = { ids: [...ids] };
      await saveState(state);
    };
    const result = await syncProfile(profile, knownIds, services, {
      dryRun: values["dry-run"],
      force: values.force,
      onUploaded: saveProgress,
    });
    if (!values["dry-run"]) state.profiles[name] = { ids: [...knownIds] };
    console.log(`${name}: ${result.uploaded.length} uploaded (${result.found} found)`);
  }
  if (!values["dry-run"]) await saveState(state);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
