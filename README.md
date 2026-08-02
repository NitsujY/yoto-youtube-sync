# yoto-sync

Sync audio you are authorized to use from YouTube videos or playlists to Yoto MYO cards.

Requirements: Node.js 22+, `yt-dlp`, `ffmpeg`, and a Yoto Developer client ID with content-management access.

```console
# macOS: install runtime and media tools
brew install node yt-dlp ffmpeg

# Install this CLI and make `yoto-sync` available in your shell
npm install
npm link

cp .env.example .env
# Set YOTO_CLIENT_ID in .env. In the Yoto Developer Dashboard, create a Public
# Client and register http://127.0.0.1:8787/callback as its redirect URL.
# Run login on the computer where you open the browser.
yoto-sync login
yoto-sync cards
yoto-sync profile add bedtime --card CARD_ID
yoto-sync add --profile bedtime 'https://www.youtube.com/playlist?list=...'
yoto-sync sync --profile bedtime
```

Run `yoto-sync --help` for all commands. Schedule `yoto-sync sync --all` with cron or launchd.
