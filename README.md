# yoto-sync

Sync audio you are authorized to use from YouTube videos or playlists to Yoto MYO cards.

Requirements: Node.js 22+, `yt-dlp`, `ffmpeg`, and a Yoto Developer client ID with content-management access.

```console
cp .env.example .env
# Set YOTO_CLIENT_ID in .env, then authenticate in the browser when prompted.
yoto-sync login
yoto-sync cards
yoto-sync profile add bedtime --card CARD_ID
yoto-sync add --profile bedtime 'https://www.youtube.com/playlist?list=...'
yoto-sync sync --profile bedtime
```

Run `yoto-sync --help` for all commands. Schedule `yoto-sync sync --all` with cron or launchd.
