# yoto-sync

Sync audio from authorized YouTube videos, playlists, or channels to Yoto Make-Your-Own (MYO) cards.

---

## Prerequisites

- **Node.js 24+**
- **yt-dlp** and **ffmpeg**
- **Yoto Developer Client ID** (Public Client with content-management scopes from the [Yoto Developer Dashboard](https://developer.yotoplay.com/))

### Installation

```console
# macOS
brew install node yt-dlp ffmpeg

# Clone & link CLI
npm install
npm link
```

---

## Authentication

Create a `.env` file with your credentials:

```console
cp .env.example .env
```

Set `YOTO_CLIENT_ID` in `.env`.

### 1. Local Login (Loopback)
In the Yoto Developer Dashboard, register `http://127.0.0.1:8787/callback` as a redirect URL. Then run:

```console
yoto-sync login
```

### 2. Remote / Windmill OAuth (Headless)
For remote workers/schedulers, register your HTTPS callback URL in Yoto:

1. Start login on the remote instance:
   ```console
   YOTO_REDIRECT_URI=https://... yoto-sync login start
   ```
2. Complete authorization after browser redirect:
   ```console
   yoto-sync login complete --code <code> --state <state>
   ```

*Note: Windmill webhook callbacks should include `include_query=code%2Cstate` so authorization parameters pass through cleanly.*

---

## Quick Start

```console
# 1. List your Yoto cards
yoto-sync cards

# 2. Create a profile linked to a card ID
yoto-sync profile add bedtime --card CARD_ID

# 3. Add YouTube channels, playlists, or videos
yoto-sync add --profile bedtime 'https://www.youtube.com/@example/videos'

# 4. Sync profile to card
yoto-sync sync --profile bedtime

# 5. Preview changes without uploading
yoto-sync sync --profile bedtime --dry-run
```

---

## Sync Options

- **`--max-stories <n>`** (default: `20`): Maximum number of chapters to keep on the card. Older stories are evicted when new ones arrive. Chapters are kept in chronological order so older stories receive smaller track numbers (1, 2, ...).
- **`--filter <text>`**: Case-insensitive filter matching video titles (e.g. `--filter "EP"`).
- **`--limit <n>`**: Limit the number of raw videos fetched from each source.
- **`--dry-run`**: Plan and inspect additions/evictions without downloading or modifying cards.
- **`--force`**: Force re-download and re-upload of all target tracks.
- **`--all`**: Sync all configured profiles.

---

## CLI Reference

```console
Commands:
  login                             Authenticate with local browser loopback
  login start                       Begin HTTPS OAuth flow for headless/remote setups
  login complete --code C --state S Complete HTTPS OAuth flow
  cards                             List available Yoto cards
  inspect [--profile <name>]        Inspect card chapters and playback status
  profile add <name> --card <id>    Add a card profile
  profile list                      List configured profiles
  profile remove <name>             Delete a profile
  add --profile <name> <url>        Add a YouTube source
  remove --profile <name> <url>     Remove a YouTube source
  sources --profile <name>          List sources for a profile
  sync [--profile <name>|--all]     Sync YouTube tracks to Yoto card
  status [--profile <name>]         Show profile status summary
  config path | show                Show configuration path or JSON
```

---

## Docker & Container Images

Pre-built multi-architecture container images:

```console
# Standalone CLI container
docker run --rm -v yoto-data:/data ghcr.io/nitsujy/yoto-sync:latest yoto-sync sync --all

# Windmill worker container
ghcr.io/nitsujy/yoto-sync-worker:latest
```

