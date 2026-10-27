# trap.larp

A private, self-hosted bio-link page in the style of guns.lol, with a full customization dashboard. It's one profile, yours, at the root of your domain, and every feature is free.

- `https://your-app.up.railway.app/` is your public page
- `https://your-app.up.railway.app/dashboard` is the password-protected editor (password comes from `DASHBOARD_PASSWORD`)

## Features

**Profile**: avatar (upload, URL or live Discord avatar), banner, display name, @handle, pronouns, bio with markdown and Discord emoji, typewriter/rotating bio lines, location, join date, UID, tags.

**Discord**: live status dot, presence card (games with elapsed time, Spotify with progress bar, custom status with emoji, desktop/mobile/web), avatar decorations, Discord badges, server tag, nameplate, "About me" sync, display-name sync, connections as links, Nitro theme colors, and **profile effects**. You can show your own or pick any of the 65 effects for free.

**Look**: 26 one-click themes; 5 layouts (classic, Discord-style, split, stacked cards, minimal); glass/solid/gradient/outline/neon cards; 55 Google Fonts plus custom font upload; 3D tilt with glare; 8 entrance animations; section reordering.

**Username effects**: rainbow, gradient, glitch, chromatic, typewriter, wave, bounce, neon, shine, shake, blur reveal, hacker scramble, outline, plus glow and sparkles.

**Backgrounds**: color, animated gradients (linear, radial, conic, mesh), image/GIF, video (optionally with sound), slideshow, Discord banner; blur, brightness, saturation, overlay, mouse parallax, Ken Burns zoom.

**Effects**: 16 particle systems (snow, rain, stars, shooting stars, fireflies, bubbles, hearts, sakura, leaves, confetti, embers, matrix, network, orbs, emoji, custom image), CRT scanlines, film grain, VHS glitch, vignette, color filters, click effects, 9 cursor trails, custom/dot/crosshair cursors.

**Music**: playlist with shuffle/repeat/fade-in, mini/full/in-card players, volume control, audio visualizers (bars, waveform, ring around avatar, card glow) and avatar pulse to the beat.

**Links**: 130+ platforms (socials, gaming, music, dev, crypto wallets with click-to-copy), 5 icon styles, brand/mono/accent/gradient colors, hover animations, link buttons.

**Widgets**: Discord server invite card, Spotify/YouTube/SoundCloud embeds, GitHub stats, countdown, local clock, text, image, custom HTML.

**Analytics**: view counter (unique or total, counted per IP address so reloading or clearing cookies can't pad it, compact format, count-up animation, carry over your old count), 30-day chart, referrers, link clicks, devices, browsers, recent visits.

**Dashboard**: live preview (desktop/mobile), autosave, settings search, media library with drag-and-drop uploads, backups, daily snapshots with one-click restore, custom CSS/HTML/JS, link embed (Open Graph) settings, animated tab titles, and the guns.lol transfer.

## Deploy on Railway

1. Push this repo to GitHub, then in Railway: **New Project → Deploy from GitHub repo** and pick it.
2. **Variables**: add `DASHBOARD_PASSWORD` with a strong password.
3. **Volume** (important): service → **Settings → Volumes → Add volume**, mount path `/data`. Without a volume Railway wipes your settings and uploads on every deploy. The app picks the volume up automatically.
4. **Networking**: click **Generate Domain**. Railway domains look like `trap-larp.up.railway.app`; a bare `trap.larp.railway.app` isn't something Railway hands out. You can attach any custom domain you own there too.
5. Open `https://<your-domain>/dashboard`, sign in, and start customizing.

Optional variables are listed in `.env.example`. One worth setting is `DASHBOARD_PATH` (for example `/my-secret-panel`), which moves the dashboard off the obvious URL.

## Moving over from guns.lol

Dashboard → **Import / backup** → *Transfer from guns.lol*:

1. Drag the **trap.larp transfer** button to your bookmarks bar (or click *Copy console script*).
2. Sign in to guns.lol and open your profile page, `guns.lol/yourname`.
3. Click the bookmark (or paste the script into the browser console). Your dashboard opens with everything it found: bio, avatar, background, music, cursor, colors, effects, socials, badges, Discord ID and view count. Untick anything you don't want and hit **Import selected**.

The transfer runs inside your own logged-in browser tab, so your guns.lol password is never typed into or stored by trap.larp. By default it also copies your media files into your own library, so nothing breaks if guns.lol links change. If the dashboard tab can't receive the data automatically (some browsers block it), the bookmark offers **Copy data** / **Download .json**. Paste or load that under *"Data didn't arrive automatically?"*.

## Discord setup

1. Discord → Settings → Advanced → turn on **Developer Mode**, then right-click yourself → **Copy User ID**.
2. Paste it in Dashboard → **Discord**.
3. Join [discord.gg/lanyard](https://discord.gg/lanyard) once with that account; that's what powers the live status.
4. Use **Check connection** to confirm the live status and profile details are coming through.

Live presence comes from [Lanyard](https://github.com/Phineas/lanyard). Bio, banner, badges and your equipped profile effect come from the public `dcdn.dstn.to` profile API, and the effects catalog from `@discord-user-card/profile-effects`.

## Running locally

```bash
npm install
DASHBOARD_PASSWORD=test npm run dev
```

Then open http://localhost:3000 and http://localhost:3000/dashboard. Data is stored in `./data` unless `DATA_DIR` is set.

## Where data lives

`DATA_DIR` (the volume on Railway) contains `config.json` (all settings), `stats.json` (analytics; visitors are stored only as salted hashes), `uploads/` (your media), `media.json` (original file names) and `backups/` (14 days of daily snapshots).
