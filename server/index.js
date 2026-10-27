import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';
import compression from 'compression';
import multer from 'multer';

import { PORT, DATA_DIR, UPLOAD_DIR, DASHBOARD_PATH, DASHBOARD_PASSWORD, MAX_UPLOAD_MB, PUBLIC_URL, EPHEMERAL_WARNING } from './env.js';
import { getConfig, setConfig, getStats, resetStats, listSnapshots, readSnapshot } from './store.js';
import { isAuthed, login, clearSession, requireAuth } from './auth.js';
import { recordView, recordClick, viewCount, statsSummary } from './analytics.js';
import { getProfile, getInvite, inviteCode, getAppIcon, effectCatalog, findEffect, checkLanyard, isSnowflake } from './discord.js';
import { normalizeGuns, localizeMedia, downloadToLibrary, ALLOWED_EXT } from './importer.js';
import { iconSet, allIconRefs } from './icons.js';
import { renderProfile, renderLogin, renderDashboard } from './render.js';
import { merge } from '../shared/schema.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = express();

// Railway puts one proxy hop in front of the app; trusting exactly that hop gives the real client IP.
const tp = process.env.TRUST_PROXY;
app.set('trust proxy', tp === undefined ? 1 : /^\d+$/.test(tp) ? Number(tp) : tp === 'true' ? true : tp === 'false' ? false : tp);
app.disable('x-powered-by');
app.use(compression());
app.use(express.json({ limit: '8mb' }));
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

const originOf = (req) => PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const withTimeout = (promise, ms) => Promise.race([promise, new Promise((r) => setTimeout(() => r(undefined), ms))]);

// ---------- static ----------
app.use('/static', express.static(path.join(ROOT, 'public'), { maxAge: '1h' }));
app.use('/shared', express.static(path.join(ROOT, 'shared'), { maxAge: '1h' }));
app.use('/uploads', express.static(UPLOAD_DIR, {
  maxAge: '30d',
  immutable: true,
  setHeaders(res) {
    // Uploaded files can never run scripts on this origin, even if opened directly.
    res.set('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; font-src 'self'");
    res.set('Access-Control-Allow-Origin', '*');
  },
}));

for (const prefix of ['/static', '/shared', '/uploads']) app.use(prefix, (req, res) => res.status(404).end());

app.get('/healthz', (req, res) => res.json({ ok: true }));
app.get('/robots.txt', (req, res) => {
  const block = getConfig().page.noIndex;
  res.type('text/plain').send(`User-agent: *\n${block ? 'Disallow: /' : 'Allow: /'}\nDisallow: ${DASHBOARD_PATH}\nDisallow: /api/\n`);
});

// ---------- public profile ----------
app.get('/', wrap(async (req, res) => {
  const cfg = getConfig();
  const authed = isAuthed(req);
  const preview = authed && req.query.preview === '1';
  const discord = cfg.discord.userId ? await withTimeout(getProfile(cfg.discord.userId), 1200) : null;
  res.set('Cache-Control', 'no-store');
  res.type('html').send(renderProfile(cfg, { origin: originOf(req), views: viewCount(cfg), discord, preview, authed }));
}));

app.get('/oembed.json', (req, res) => {
  const cfg = getConfig();
  res.json({
    version: '1.0',
    type: 'link',
    provider_name: cfg.page.siteName || 'trap.larp',
    provider_url: originOf(req),
    author_name: cfg.page.embedTitle || cfg.page.title || cfg.profile.displayName,
    author_url: originOf(req),
  });
});

app.post('/api/view', (req, res) => {
  const cfg = getConfig();
  if (!(isAuthed(req) && !cfg.views.countOwner)) {
    recordView(req, { referrer: String(req.body?.referrer || '').slice(0, 500), cooldownMinutes: cfg.views.cooldown });
  }
  res.json({ views: viewCount(getConfig()) });
});

app.get('/api/views', (req, res) => res.json({ views: viewCount(getConfig()) }));

app.post('/api/click', (req, res) => {
  const cfg = getConfig();
  const id = String(req.body?.id || '');
  const known = [...cfg.links.items, ...cfg.links.buttons].some((l) => l.id === id);
  if (known && !(isAuthed(req) && !cfg.views.countOwner)) recordClick(id);
  res.status(204).end();
});

app.get('/api/icons', (req, res) => {
  const refs = String(req.query.refs || '').split(',').filter((r) => /^(si|lu):[a-z0-9-]+$/.test(r)).slice(0, 300);
  res.set('Cache-Control', 'public, max-age=86400').json(iconSet(refs));
});

// Discord lookups are limited to what this page actually shows (or the signed-in owner),
// so the server can't be used as an open proxy.
app.get('/api/discord/profile/:id', wrap(async (req, res) => {
  if (req.params.id !== getConfig().discord.userId && !isAuthed(req)) return res.status(404).json(null);
  res.set('Cache-Control', 'public, max-age=60').json(await getProfile(req.params.id));
}));

app.get('/api/discord/invite/:code', wrap(async (req, res) => {
  const code = req.params.code;
  const allowed = getConfig().widgets.items.some((w) => w.type === 'discord_server' && inviteCode(w.invite) === code);
  if (!allowed && !isAuthed(req)) return res.status(404).json(null);
  res.set('Cache-Control', 'public, max-age=300').json(await getInvite(code));
}));

app.get('/api/effects/:id', (req, res) => {
  const effect = findEffect(req.params.id);
  if (!effect) return res.status(404).json(null);
  res.set('Cache-Control', 'public, max-age=86400').json(effect);
});

app.get('/api/discord/app-icon/:id', wrap(async (req, res) => {
  const url = isSnowflake(req.params.id) ? await getAppIcon(req.params.id) : null;
  if (!url) return res.status(404).end();
  res.set('Cache-Control', 'public, max-age=86400').redirect(302, url);
}));

// ---------- auth + dashboard ----------
app.post('/api/auth/login', login);
app.post('/api/auth/logout', (req, res) => {
  clearSession(req, res);
  res.json({ ok: true });
});

app.get(DASHBOARD_PATH, (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!isAuthed(req)) return res.type('html').send(renderLogin({ configured: Boolean(DASHBOARD_PASSWORD) }));
  res.type('html').send(renderDashboard({ ephemeral: EPHEMERAL_WARNING }));
});

const admin = express.Router();
admin.use(requireAuth);

admin.get('/config', (req, res) => res.json(getConfig()));

admin.put('/config', (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return res.status(400).json({ error: 'Invalid config.' });
  const next = req.body;
  // Give every link/button a stable id so clicks can be counted.
  for (const list of [next.links?.items, next.links?.buttons]) {
    if (Array.isArray(list)) for (const item of list) if (item && !item.id) item.id = crypto.randomBytes(5).toString('hex');
  }
  res.json(setConfig(next));
});

admin.get('/stats', (req, res) => res.json(statsSummary(getConfig())));
admin.post('/stats/reset', (req, res) => {
  resetStats();
  res.json(statsSummary(getConfig()));
});

admin.get('/icons', (req, res) => res.set('Cache-Control', 'private, max-age=3600').json(iconSet(allIconRefs())));
admin.get('/effects', (req, res) => res.set('Cache-Control', 'private, max-age=3600').json(effectCatalog()));

admin.get('/discord/check', wrap(async (req, res) => {
  const id = String(req.query.id || '');
  if (!isSnowflake(id)) return res.json({ lanyard: { ok: false, error: 'Not a valid user ID.' }, profile: null });
  const [lanyard, profile] = await Promise.all([checkLanyard(id), getProfile(id)]);
  res.json({ lanyard, profile });
}));

// ---------- media library ----------
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      let ext = path.extname(file.originalname || '').toLowerCase();
      if (ext === '.jpeg') ext = '.jpg';
      cb(null, `${crypto.randomBytes(9).toString('base64url')}${ext}`);
    },
  }),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 20 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, ALLOWED_EXT.has(ext));
  },
});

const META_FILE = path.join(DATA_DIR, 'media.json');
const readMeta = () => { try { return JSON.parse(fs.readFileSync(META_FILE, 'utf8')); } catch { return {}; } };
const writeMeta = (m) => fs.writeFileSync(META_FILE, JSON.stringify(m));

function mediaKind(name) {
  const ext = path.extname(name).toLowerCase();
  if (['.mp4', '.webm', '.mov', '.m4v', '.ogv'].includes(ext)) return 'video';
  if (['.mp3', '.ogg', '.wav', '.m4a', '.aac', '.flac', '.weba', '.opus'].includes(ext)) return 'audio';
  if (['.woff', '.woff2', '.ttf', '.otf'].includes(ext)) return 'font';
  if (['.cur', '.ani'].includes(ext)) return 'cursor';
  return 'image';
}

function listMedia() {
  const meta = readMeta();
  return fs.readdirSync(UPLOAD_DIR)
    .filter((n) => !n.startsWith('.'))
    .map((name) => {
      const st = fs.statSync(path.join(UPLOAD_DIR, name));
      return { name, url: `/uploads/${name}`, size: st.size, mtime: st.mtimeMs, kind: mediaKind(name), label: meta[name] || name };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

admin.get('/media', (req, res) => res.json(listMedia()));

admin.post('/media', (req, res) => {
  upload.array('files', 20)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? `Files must be under ${MAX_UPLOAD_MB} MB.` : err.message });
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: 'Unsupported file type.' });
    const meta = readMeta();
    for (const f of files) meta[f.filename] = f.originalname;
    writeMeta(meta);
    res.json(files.map((f) => ({ name: f.filename, url: `/uploads/${f.filename}`, kind: mediaKind(f.filename), label: f.originalname, size: f.size })));
  });
});

admin.post('/media/fetch', wrap(async (req, res) => {
  try {
    const url = await downloadToLibrary(String(req.body?.url || ''));
    const meta = readMeta();
    meta[path.basename(url)] = String(req.body.url).split('/').pop().split('?')[0].slice(0, 120);
    writeMeta(meta);
    res.json({ url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}));

admin.delete('/media/:name', (req, res) => {
  const name = path.basename(req.params.name);
  fs.rm(path.join(UPLOAD_DIR, name), { force: true }, () => {
    const meta = readMeta();
    delete meta[name];
    writeMeta(meta);
    res.json({ ok: true });
  });
});

// ---------- backup / import ----------
admin.get('/export', (req, res) => {
  const day = new Date().toISOString().slice(0, 10);
  res.set('Content-Disposition', `attachment; filename="trap-larp-backup-${day}.json"`);
  res.json({ kind: 'trap.larp-backup', v: 1, exportedAt: new Date().toISOString(), config: getConfig(), stats: req.query.stats === '1' ? getStats() : undefined });
});

admin.post('/import/backup', (req, res) => {
  const body = req.body || {};
  const cfg = body.kind === 'trap.larp-backup' ? body.config : body;
  if (!cfg || typeof cfg !== 'object' || !cfg.profile) return res.status(400).json({ error: 'That file isn\'t a trap.larp backup.' });
  res.json(setConfig(cfg));
});

admin.get('/snapshots', (req, res) => res.json(listSnapshots()));
admin.post('/snapshots/restore', (req, res) => {
  const snap = readSnapshot(String(req.body?.name || ''));
  if (!snap) return res.status(404).json({ error: 'Snapshot not found.' });
  res.json(setConfig(snap));
});

admin.get('/transfer', (req, res) => {
  const code = fs.readFileSync(path.join(ROOT, 'public', 'transfer', 'collector.js'), 'utf8')
    .replaceAll('__ORIGIN__', originOf(req))
    .replaceAll('__DASH__', DASHBOARD_PATH);
  res.json({ code, bookmarklet: `javascript:${encodeURIComponent(code)}` });
});

admin.post('/import/guns/preview', (req, res) => {
  try {
    res.json(normalizeGuns(req.body?.payload));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

admin.post('/import/guns/apply', wrap(async (req, res) => {
  const { patch = {}, sections = [], download = true } = req.body || {};
  const chosen = {};
  for (const key of sections) {
    const [sec, field] = String(key).split('.');
    if (patch[sec]?.[field] !== undefined) (chosen[sec] ||= {})[field] = patch[sec][field];
  }
  // Each imported link needs an id for click stats.
  for (const item of chosen.links?.items || []) item.id ||= crypto.randomBytes(5).toString('hex');
  for (const item of chosen.links?.buttons || []) item.id ||= crypto.randomBytes(5).toString('hex');
  const downloads = download ? await localizeMedia(chosen) : [];
  const config = setConfig(merge(getConfig(), chosen));
  res.json({ config, downloads });
}));

app.use('/api/admin', admin);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
app.use((req, res) => res.redirect(302, '/'));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error('[server]', err);
  if (!res.headersSent) res.status(status).json({ error: status >= 500 ? 'Server error.' : err.message });
});

app.listen(PORT, () => {
  console.log(`trap.larp running on :${PORT}`);
  console.log(`  profile:   /`);
  console.log(`  dashboard: ${DASHBOARD_PATH}`);
  console.log(`  data dir:  ${DATA_DIR}`);
  if (!DASHBOARD_PASSWORD) console.warn('  ! DASHBOARD_PASSWORD is not set — the dashboard is locked until you set it.');
  if (EPHEMERAL_WARNING) console.warn('  ! No Railway volume attached — settings and uploads will be lost on redeploy. Attach a volume (mount path /data).');
});
