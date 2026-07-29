# disdex finder — Telegram Mini App

The same idea as the Discord bot — `/serverfinder` and `/userfinder` backed
by [disdex.io](https://disdex.io/api), gated behind admin-issued access keys
— but as a Telegram Mini App instead of slash commands.

## Same API limitations as the bot

The disdex API only documents these filters, which is what's wired up here:

- **Servers**: `q`, `tag`, `tag_status`, `sort` (members/online/boosts/newest/oldest), `nsfw`, `vanity`
- **Users**: `q`, `type` (user/bot), `sort` (invites/servers/username/newest/oldest)

## Access model

Mirrors the Discord bot, just keyed by Telegram user ID instead of Discord
user ID:

- Admins (in `ADMIN_IDS`) always have access and can't be banned.
- Admins generate keys from the **Admin** tab in the app — either assigned
  directly to a Telegram user ID, or as an unassigned code to hand out.
- Anyone without access sees a "redeem a key" screen instead of the
  finder tabs.
- Admins can ban/unban a Telegram user ID from the same tab; a ban holds
  even if that person already redeemed a key.

## How it authenticates

Telegram Mini Apps hand your frontend a signed `initData` string
(`Telegram.WebApp.initData`) proving who opened the app. The frontend sends
that on every API call in an `X-Telegram-Init-Data` header; the server
verifies its signature against your bot token (`telegramAuth.js`) before
trusting the user ID in it — the same mechanism Telegram's own docs
recommend, so no separate login step is needed.

## Setup

1. **Create the bot.** Message [@BotFather](https://t.me/BotFather) on
   Telegram → `/newbot` → follow the prompts → copy the token it gives you.

2. **Deploy this server somewhere public over HTTPS.** Telegram Mini Apps
   require HTTPS. Railway works the same way as with the Discord bot:
   - New Project → Deploy from GitHub repo → this repo.
   - Variables tab → add `TELEGRAM_BOT_TOKEN` and `ADMIN_IDS` (your own
     Telegram numeric user ID — get it from
     [@userinfobot](https://t.me/userinfobot)).
   - Railway sets `PORT` automatically; leave it unset in Variables.
   - Once deployed, Railway gives you a public URL like
     `https://your-app.up.railway.app` — note it for the next step.

3. **Point the bot at the Mini App.** Back in @BotFather:
   - `/mybots` → your bot → **Bot Settings** → **Menu Button** → **Configure
     Menu Button** → paste your Railway URL. This makes a button next to the
     message box that opens the Mini App directly.
   - Optionally also `/newapp` to register it as a full Mini App with its
     own name/icon/description for the app directory.

4. **Open it.** In a chat with your bot, tap the menu button (or however you
   configured launch). The app opens inside Telegram, calls `/api/me`, and
   shows either the finder tabs or the "redeem a key" screen depending on
   your access.

Requires Node.js 18+ (uses the built-in `fetch`).

## Storage

Keys, authorized users, and bans live in `data/store.json`, created
automatically on first run. On Railway, add a **Volume** mounted at
`/app/data` (same as the Discord bot) so it survives redeploys.
