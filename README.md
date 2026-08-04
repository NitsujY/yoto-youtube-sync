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
# Set YOTO_CLIENT_ID in .env. `login` prints a Yoto URL and code; open it on
# any device, then leave the CLI running while you authorize.
yoto-sync login
yoto-sync cards
yoto-sync profile add bedtime --card CARD_ID
yoto-sync add --profile bedtime 'https://www.youtube.com/playlist?list=...'
yoto-sync sync --profile bedtime
# Limit a channel or playlist to its newest 10 videos
yoto-sync sync --profile bedtime --limit 10
```

Run `yoto-sync --help` for all commands. Schedule `yoto-sync sync --all` with cron or launchd.
