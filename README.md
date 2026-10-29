# trap.larp

A private, self-hosted bio-link page in the style of guns.lol, with a full customization dashboard. It's one profile, yours, at the root of your domain, and every feature is free.

- `https://your-app.up.railway.app/` is your public page
- `https://your-app.up.railway.app/dashboard` is the password-protected editor (password comes from `DASHBOARD_PASSWORD`)

It runs on [Railway](#deploy-on-railway) (the default), or for free on [Vercel with Firebase](#deploy-on-vercel-free-with-firebase).

## Features

**Profile**: avatar (upload, URL or live Discord avatar), banner, display name, @handle, pronouns, bio with markdown and Discord emoji, typewriter/rotating bio lines, location, join date, UID, tags.

**Discord**: live status dot, presence card (games with elapsed time, Spotify with progress bar, custom status with emoji, desktop/mobile/web), avatar decorations, Discord badges, server tag, nameplate, "About me" sync, display-name sync, connections as links, Nitro theme colors, and **profile effects**. You can show your own or pick any of the 65 effects for free.

**Look**: 26 one-click themes; 5 layouts (classic, Discord-style, split, stacked cards, minimal); glass/solid/gradient/outline/neon cards; 55 Google Fonts plus custom font upload; 3D tilt with glare; 8 entrance animations; section reordering.

**Username effects**: rainbow, gradient, glitch, chromatic, typewriter, wave, bounce, neon, shine, shake, blur reveal, hacker scramble, outline, plus glow and sparkles.

**Backgrounds**: color, animated gradients (linear, radial, conic, mesh), image/GIF, video (optionally with sound), slideshow, Discord banner; blur, brightness, saturation, overlay, mouse parallax, Ken Burns zoom.

**Effects**: 16 particle systems (snow, rain, stars, shooting stars, fireflies, bubbles, hearts, sakura, leaves, confetti, embers, matrix, network, orbs, emoji, custom image), CRT scanlines, film grain, VHS glitch, vignette, color filters, click effects, 9 cursor trails, custom/dot/crosshair cursors.

**Music**: playlist of uploaded files or YouTube links, with shuffle/repeat/fade-in, mini/full/in-card players, volume control, audio visualizers (bars, waveform, ring around avatar, card glow) and avatar pulse to the beat.

**Links**: 130+ platforms (socials, gaming, music, dev, crypto wallets with click-to-copy), 5 icon styles, brand/mono/accent/gradient colors, hover animations, link buttons.

**Widgets**: Discord server invite card, Spotify/YouTube/SoundCloud embeds, GitHub stats, countdown, local clock, text, image, custom HTML.

**Analytics**: view counter (unique or total, counted per IP address so reloading or clearing cookies can't pad it, compact format, count-up animation, carry over your old count), 30-day chart, referrers, link clicks, devices, browsers, recent visits.

**Comments**: an optional comments section under your profile. Visitors leave one comment each (one per IP address), up to 200 characters, with a name, @username and an optional picture. You read and delete them in the dashboard.

**Performance**: effects lighten themselves on weak phones and computers (particles at 30 fps with fewer of them, a softer card blur) and switch over automatically if the page starts to stutter. You can force full quality in Effects → Performance.

**Dashboard**: live preview (desktop/mobile), autosave, settings search, media library with drag-and-drop uploads, one-click "Save to database" for files linked from other sites, backups you can copy and paste, daily snapshots with one-click restore, custom CSS/HTML/JS, link embed (Open Graph) settings, animated tab titles, and the guns.lol transfer.

## Deploy on Railway

1. Push this repo to GitHub, then in Railway: **New Project → Deploy from GitHub repo** and pick it.
2. **Variables**: add `DASHBOARD_PASSWORD` with a strong password.
3. **Volume** (important): service → **Settings → Volumes → Add volume**, mount path `/data`. Without a volume Railway wipes your settings and uploads on every deploy. The app picks the volume up automatically.
4. **Networking**: click **Generate Domain**. Railway domains look like `trap-larp.up.railway.app`; a bare `trap.larp.railway.app` isn't something Railway hands out. You can attach any custom domain you own there too.
5. Open `https://<your-domain>/dashboard`, sign in, and start customizing.

Optional variables are listed in `.env.example`. One worth setting is `DASHBOARD_PATH` (for example `/my-secret-panel`), which moves the dashboard off the obvious URL.

## Deploy on Vercel (free, with Firebase)

Vercel's servers can't keep files, so in Vercel mode everything (settings, analytics and your uploaded media) is saved in a free Firebase **Firestore** database instead. You need a Google account, a Vercel account and this repo on GitHub. No credit card is needed for either.

### 1. Create the Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and click **Create a project** (or **Add project**).
2. Name it (for example `trap-larp`), click through the steps and **Create project**. You can turn Google Analytics and Gemini off; trap.larp doesn't use them.
3. Stay on the free **Spark** plan. Don't upgrade.

### 2. Create the Firestore database

1. In the left menu open **Firestore Database**. Depending on your console version it's under *Build* or *Databases & Storage*.
2. Click **Create database**.
3. If it asks for an edition, pick **Standard**. Leave the database ID as `(default)`.
4. Pick a location. `nam5 (United States)` is a good choice because Vercel runs your site in the US by default. You can't change it later.
5. Choose **Start in production mode** and click **Create**. Production mode starts with the database locked to everyone; step 3 decides who gets in.

### 3. Give the server access to Firebase

Pick **one** of these two ways. **A** needs nothing but the Firebase console. **B** needs you to download a file.

#### A. A Firebase login (no download)

The server signs in to Firebase as a user you create, and a security rule lets only that user into the database.

1. **Copy the web app config.** Click the **gear icon** next to *Project Overview* → **Project settings** → *General* tab, and scroll to **Your apps**. Click the web icon **`</>`**, give it any nickname (leave *Firebase Hosting* unticked) and click **Register app**. Firebase shows code like this:

   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project",
     ...
   };
   ```

   Copy it and keep it for step 4. Everything from `{` to `}` is enough, but copying the whole block is fine too. If you already registered an app, the same code is under **Your apps** → *SDK setup and configuration* → **Config**.
2. **Turn on email sign-in.** In the left menu open **Authentication** → **Get started** → **Sign-in method** tab → **Email/Password**. Turn on the first switch and click **Save**.
3. **Create the site's user.** **Authentication** → **Users** tab → **Add user**. Use any email address; it doesn't have to be real, and nothing is sent to it. Pick a strong password that's different from your dashboard password. After it's added, copy the user's **User UID** from the list.
4. **Lock the database to that user.** **Firestore Database** → **Rules** tab. Replace everything there with this, put your User UID in place of `PASTE-USER-UID-HERE`, and click **Publish**:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == 'PASTE-USER-UID-HERE';
       }
     }
   }
   ```

The web config isn't secret on its own; the rule is what keeps everyone else out. The user's password is secret, though: anyone who has it can change your database.

#### B. A service account key (needs a download)

1. Click the **gear icon** next to *Project Overview* → **Project settings** → **Service accounts** tab.
2. Click **Generate new private key** → **Generate key**. A `.json` file downloads.
3. Treat this file like a password: it gives full access to your Firebase project. Don't commit it to GitHub or share it.

With a key the database can stay in production mode as created in step 2; no rules or users are needed.

### 4. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com), sign up with GitHub (the free **Hobby** plan) and click **Add New... → Project**.
2. **Import** your trap.larp repo. Leave *Framework Preset*, *Root Directory* and the build settings as they are; `vercel.json` in this repo takes care of them.
3. Open **Environment Variables** and add these:

   | Key | Value |
   | --- | --- |
   | `USEVERCEL` | `true` |
   | `DASHBOARD_PASSWORD` | A strong password for your dashboard |
   | `GOOGLEFIREBASECONFIG` | **If you used A:** the web app config you copied.<br>**If you used B:** the whole contents of the `.json` key file, from the first `{` to the last `}`. |
   | `FIREBASE_EMAIL` | **A only:** the email of the user you created |
   | `FIREBASE_PASSWORD` | **A only:** that user's password |

   The names work in any capitalization (`usevercel` is fine too).
4. Click **Deploy** and wait for it to finish (about a minute).
5. Open `https://<your-project>.vercel.app/dashboard`, sign in with your dashboard password, and start customizing.

Saved changes show up on your page within about 5 seconds: each of Vercel's servers keeps your settings for a few seconds, so a flood of visitors can't use up Firestore's free daily reads.

### Changing variables later

Vercel → your project → **Settings → Environment Variables**. Edit or add what you need, then go to **Deployments**, open the **⋯** menu on the latest deployment and click **Redeploy**. New values only apply after a redeploy.

Optional variables:

| Key | What it does |
| --- | --- |
| `DASHBOARD_PATH` | Moves the dashboard off `/dashboard`, for example `/my-secret-panel` |
| `MAX_UPLOAD_MB` | Largest file you can upload. Defaults to `25` in Vercel mode |
| `SESSION_SECRET` | Extra secret mixed into login cookies; changing it signs you out everywhere |
| `PUBLIC_URL` | Your site address for link embeds. Picked up automatically on Vercel; only set it if embeds show the wrong domain |

A custom domain goes in **Settings → Domains**.

### Free plan limits

- **Vercel Hobby** is free for personal, non-commercial sites.
- **Firestore (Spark plan)** gives you 1 GB of storage, 50,000 reads and 20,000 writes per day. A counted visit uses 5 to 7 reads (more with Discord widgets) and 2 writes, so a few thousand visitors a day fits comfortably. If you ever run out, the site shows an error until the quota resets at midnight Pacific time.
- **Uploads** are stored inside Firestore, so they share that 1 GB. Files are capped at 25 MB each by default. Vercel's CDN keeps a copy of images and other whole files after the first view, so repeat visits don't touch Firestore. For music, YouTube links take no space at all.
- **Comments** only cost anything when a visitor scrolls down to them: about 22 reads to show a page of 20 comments, and a handful of reads and writes to post one.
- Firebase's separate file storage product (Cloud Storage) now requires a paid plan with a card, which is why trap.larp doesn't use it.

### If something's wrong

- **The site only shows "trap.larp isn't set up yet"**: the message under it says which variable is missing or wrong. Fix it in Vercel and redeploy.
- **"Firebase has no Firestore database yet"**: do step 2.
- **"Firebase sign-in failed"** (way A): `FIREBASE_EMAIL` or `FIREBASE_PASSWORD` doesn't match the user in Authentication → Users.
- **"Firebase sign-in is off"** (way A): do step 3A.2.
- **"Firestore's rules blocked the server"** (way A): do step 3A.4. The message shows the exact User ID to put in the rule.
- **"Firebase refused the service account key"** (way B): generate a new key (step 3B), paste it into `GOOGLEFIREBASECONFIG` again, and redeploy.
- **Leaked the password (A)?** In Authentication → Users, delete the user and add a new one. Put its UID in the rule (3A.4), then update `FIREBASE_EMAIL` and `FIREBASE_PASSWORD`.
- **Leaked the key (B)?** In the Firebase console → Project settings → Service accounts, click *Manage service account permissions*. That opens Google Cloud: pick the `firebase-adminsdk` account → **Keys** tab and delete the old key. Then generate a new one (step 3B) and update `GOOGLEFIREBASECONFIG`.

### Moving from Railway to Vercel

On the old site, open Dashboard → **Import / backup** → **Copy backup**. On the new Vercel site, paste it under **Restore a copied backup**. Media files aren't part of a backup, so re-upload them. Or paste each file's full old address (`https://your-old-app.up.railway.app/uploads/...`) into its field and press **Save to database**.

## Moving over from guns.lol

Dashboard → **Import / backup** → *Transfer from guns.lol*:

1. Drag the **trap.larp transfer** button to your bookmarks bar (or click *Copy console script*).
2. Sign in to guns.lol and open your profile page, `guns.lol/yourname`.
3. Click the bookmark (or paste the script into the browser console). Your dashboard opens with everything it found: bio, avatar, background, music, cursor, colors, effects, socials, badges, Discord ID and view count. Untick anything you don't want and hit **Import selected**.

The transfer runs inside your own logged-in browser tab, so your guns.lol password is never typed into or stored by trap.larp. By default it also copies your media files into your own library, so nothing breaks if guns.lol links change. If the dashboard tab can't receive the data automatically (some browsers block it), the bookmark offers **Copy data** / **Download .json**. Paste or load that under *"Data didn't arrive automatically?"*.

## Backups and keeping your media safe

- **Copy backup** (Dashboard → Import / backup) copies all your settings to the clipboard. Paste them anywhere to keep them, such as a note or a message to yourself. To restore, paste them under **Restore a copied backup**. **Download backup** saves the same thing as a `.json` file.
- **Save to database**: when you paste a link to an image, MP3 or video hosted somewhere else into any media field, a **Save to database** button appears. It copies the file into your own storage (your Railway volume, or Firestore on Vercel) and swaps the link for your copy, so your page keeps working even if the original gets deleted. YouTube links can't be saved this way; they play straight from YouTube.

## Comments

Turn them on in Dashboard → **Comments**. They appear in their own card under your profile, and only load when a visitor scrolls to them.

- **Who can post:** one comment per IP address. Different addresses on the same home IPv6 network count as one. Deleting a comment doesn't free that address up again, so someone you deleted can't just post again.
- **What they can post:** a display name (up to 32 characters), an @username (2–24 letters, numbers, `_` or `.`), a message of up to 200 characters, and optionally a picture. Pictures must be PNG, JPEG or WebP and at most 3 MB; GIFs, videos and animated images are refused. The visitor's browser shrinks the picture to 256 × 256 before sending, which also strips hidden data like a photo's location. Nobody can use your own name or @handle.
- **Protection:** the server checks every picture's actual contents, not just its name, and refuses huge dimensions. Messages are cleaned of invisible and direction-flipping characters and always shown as plain text, so HTML or scripts in them never run. Each IP gets 5 tries to post every 10 minutes and 30 list loads a minute. The whole site takes at most 60 new comments an hour, in case many addresses flood it at once. A signed form token, a hidden trap field for bots and an origin check stop scripted and cross-site posting.
- **Moderation:** Dashboard → **Comments** lists every comment with a **Delete** button.

## Discord setup

1. Discord → Settings → Advanced → turn on **Developer Mode**, then right-click yourself → **Copy User ID**.
2. Paste it in Dashboard → **Discord**.
3. Join [discord.gg/lanyard](https://discord.gg/lanyard) once with that account; that's what powers the live status.
4. Use **Check connection** to confirm the live status and profile details are coming through.

Live presence comes from [Lanyard](https://github.com/Phineas/lanyard). Bio, banner, badges and your equipped profile effect come from the public `dcdn.dstn.to` profile API, and the effects catalog from `@discord-user-card/profile-effects`.

## Security

- **Use a long dashboard password.** At least 12 characters; a few random words works well. The dashboard warns you if it's shorter. Wrong passwords are limited to 8 every 15 minutes per IP address (IPv6 per /64 network).
- **Hide the dashboard.** Set `DASHBOARD_PATH` to something hard to guess. The path isn't shown to visitors anywhere, including robots.txt and the page source.
- **What's already handled:**
  - **Logins:** they're signed with a random key kept in your storage, so nothing visitors can see helps them guess your password.
  - **Flood limits:** every public endpoint has a per-IP limit, so request floods are turned away before they cost database reads or writes.
  - **Pages:** they can't be framed by other sites.
  - **"Save to database":** it refuses private and internal network addresses.
  - **Comments:** see above.

## Running locally

```bash
npm install
DASHBOARD_PASSWORD=test npm run dev
```

Then open http://localhost:3000 and http://localhost:3000/dashboard. Data is stored in `./data` unless `DATA_DIR` is set.

To try Vercel mode locally against your real Firebase project, set the same variables as on Vercel, for example:

```bash
USEVERCEL=true GOOGLEFIREBASECONFIG='{"apiKey":"...","projectId":"..."}' FIREBASE_EMAIL=you@example.com FIREBASE_PASSWORD=... DASHBOARD_PASSWORD=test npm run dev
```

## Where data lives

**Railway / local**: `DATA_DIR` (the volume on Railway) contains `config.json` (all settings), `stats.json` (analytics; visitors are stored only as salted hashes), `uploads/` (your media), `media.json` (original file names), `backups/` (14 days of daily snapshots), `comments.json` (comments, and the salted hashes of IPs that have commented), `avatars/` (commenters' pictures) and `secret.key` (a random key for signing logins; keep it private).

**Vercel**: the same things live in Firestore. `site/config` and `site/stats` hold settings and analytics, `visitors` holds the salted visitor hashes, `files` holds your media (each file split into 960 KB pieces), `uploading` tracks uploads in progress, `snapshots` holds 14 days of daily snapshots, `logins` tracks failed sign-in attempts, `comments` and `avatars` hold comments and their pictures, `commentIps` holds the salted hashes of IPs that have commented, `limits` holds the rate-limit counters, and `site/secret` holds a random key for signing logins.
