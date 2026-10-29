// The whole site as an Express app. server/index.js runs it as a normal server (Railway, local);
// api/index.js hands it to Vercel as a function.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';
import compression from 'compression';

import { DASHBOARD_PATH, DASHBOARD_PASSWORD, MAX_UPLOAD_MB, PUBLIC_URL, EPHEMERAL_WARNING, USE_VERCEL } from './env.js';
import { store, setupError } from './store/index.js';
import { isAuthed, login, clearSession, requireAuth, authReady } from './auth.js';
import { recordView, recordClick, viewCount, statsSummary, ipKey } from './analytics.js';
import { getProfile, getInvite, inviteCode, getAppIcon, effectCatalog, findEffect, checkLanyard, isSnowflake } from './discord.js';
import { normalizeGuns, localizeMedia, downloadToLibrary } from './importer.js';
import { publicComments, adminComments } from './comments.js';
import { PART_SIZE, newName, validName } from './media.js';
import { limit, allow } from './limits.js';
import { iconSet, allIconRefs } from './icons.js';
import { renderProfile, renderLogin, renderDashboard } from './render.js';
import { merge } from '../shared/schema.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = express();
export default app;

// Railway and Vercel each put one proxy hop in front of the app; trusting exactly that hop gives the real client IP.
const tp = process.env.TRUST_PROXY;
app.set('trust proxy', tp === undefined ? 1 : /^\d+$/.test(tp) ? Number(tp) : tp === 'true' ? true : tp === 'false' ? false : tp);
app.disable('x-powered-by');
app.use(compression());
// Public endpoints only take small bodies; the dashboard (settings, imports) and comment
// pictures get room for more.
const smallJson = express.json({ limit: '64kb' });
const commentJson = express.json({ limit: '4500kb' });
const bigJson = express.json({ limit: '8mb' });
app.use((req, res, next) => {
  if (req.path.startsWith('/api/admin/')) return bigJson(req, res, next);
  if (req.path === '/api/comments' && req.method === 'POST') return commentJson(req, res, next);
  return smallJson(req, res, next);
});
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // No other site may frame these pages (clickjacking), inject a <base> or load plugins.
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('Content-Security-Policy', "frame-ancestors 'self'; base-uri 'self'; object-src 'none'");
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  next();
});

// Storage isn't set up right (usually a missing or wrong environment variable): say so plainly.
if (setupError) {
  console.error(`[setup] ${setupError}`);
  app.use((req, res) => res.status(500).type('text/plain').send(`trap.larp isn't set up yet.\n\n${setupError}\n`));
}

const originOf = (req) => PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const withTimeout = (promise, ms) => Promise.race([promise, new Promise((r) => setTimeout(() => r(undefined), ms))]);

// ---------- static ----------
// On Vercel, the CDN keeps a copy of the app's own files; it's cleared on every deploy.
const cdnCache = USE_VERCEL ? { setHeaders: (res) => res.set('CDN-Cache-Control', 'public, max-age=86400') } : {};
app.use('/static', express.static(path.join(ROOT, 'public'), { maxAge: '1h', ...cdnCache }));
app.use('/shared', express.static(path.join(ROOT, 'shared'), { maxAge: '1h', ...cdnCache }));
app.use('/uploads', limit('uploads', 60e3, 300), (req, res, next) => {
  // Uploaded files can never run scripts on this origin, even if opened directly.
  res.set('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; font-src 'self'");
  res.set('Access-Control-Allow-Origin', '*');
  next();
}, wrap((req, res, next) => store.serveUploads(req, res, next)));

for (const prefix of ['/static', '/shared', '/uploads']) app.use(prefix, (req, res) => res.status(404).end());

// Everything below signs or checks logins and tokens, so load the signing key first.
app.use(wrap(async (req, res, next) => {
  await authReady();
  next();
}));

app.get('/healthz', (req, res) => res.json({ ok: true }));
// The dashboard isn't listed here: that would reveal a secret DASHBOARD_PATH. It sends noindex itself.
app.get('/robots.txt', limit('lookup', 60e3, 120), wrap(async (req, res) => {
  const block = (await store.getConfig()).page.noIndex;
  res.type('text/plain').send(`User-agent: *\n${block ? 'Disallow: /' : 'Allow: /'}\nDisallow: /api/\n`);
}));

// ---------- public profile ----------
app.get('/', limit('page', 60e3, 120), wrap(async (req, res) => {
  const [cfg, stats] = await Promise.all([store.getConfig(), store.getStats()]);
  const authed = isAuthed(req);
  const preview = authed && req.query.preview === '1';
  const discord = cfg.discord.userId ? await withTimeout(getProfile(cfg.discord.userId), 1200) : null;
  res.set('Cache-Control', 'no-store');
  res.type('html').send(renderProfile(cfg, { origin: originOf(req), views: viewCount(cfg, stats), discord, preview, authed }));
}));

app.get('/oembed.json', limit('lookup', 60e3, 120), wrap(async (req, res) => {
  const cfg = await store.getConfig();
  res.json({
    version: '1.0',
    type: 'link',
    provider_name: cfg.page.siteName || 'trap.larp',
    provider_url: originOf(req),
    author_name: cfg.page.embedTitle || cfg.page.title || cfg.profile.displayName,
    author_url: originOf(req),
  });
}));

app.post('/api/view', limit('view', 60e3, 20), wrap(async (req, res) => {
  const cfg = await store.getConfig();
  let stats = null;
  if (!(isAuthed(req) && !cfg.views.countOwner)) {
    ({ stats } = await recordView(req, { referrer: String(req.body?.referrer || '').slice(0, 500), cooldownMinutes: cfg.views.cooldown }));
  }
  res.json({ views: viewCount(cfg, stats || await store.getStats()) });
}));

app.get('/api/views', limit('views', 60e3, 30), wrap(async (req, res) => {
  const [cfg, stats] = await Promise.all([store.getConfig(), store.getStats()]);
  res.json({ views: viewCount(cfg, stats) });
}));

// A click counts once per link per IP every 10 minutes: spamming one can't pad the stats or
// spend a database write per request.
app.post('/api/click', limit('click', 60e3, 30), wrap(async (req, res) => {
  const cfg = await store.getConfig();
  const id = String(req.body?.id || '');
  const known = [...cfg.links.items, ...cfg.links.buttons].some((l) => l.id === id);
  if (known && !(isAuthed(req) && !cfg.views.countOwner) && allow('click-link', `${ipKey(req.ip)}|${id}`, 10 * 60e3, 1).ok) await recordClick(id);
  res.status(204).end();
}));

app.use('/api/comments', publicComments);

app.use(['/api/icons', '/api/discord', '/api/effects'], limit('lookup', 60e3, 120));

app.get('/api/icons', (req, res) => {
  const refs = String(req.query.refs || '').split(',').filter((r) => /^(si|lu):[a-z0-9-]+$/.test(r)).slice(0, 300);
  res.set('Cache-Control', 'public, max-age=86400').json(iconSet(refs));
});

// Discord lookups are limited to what this page actually shows (or the signed-in owner),
// so the server can't be used as an open proxy.
app.get('/api/discord/profile/:id', wrap(async (req, res) => {
  if (req.params.id !== (await store.getConfig()).discord.userId && !isAuthed(req)) return res.status(404).json(null);
  res.set('Cache-Control', 'public, max-age=60').json(await getProfile(req.params.id));
}));

app.get('/api/discord/invite/:code', wrap(async (req, res) => {
  const code = req.params.code;
  const allowed = (await store.getConfig()).widgets.items.some((w) => w.type === 'discord_server' && inviteCode(w.invite) === code);
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
app.post('/api/auth/login', limit('login', 60e3, 10), wrap(login));
app.post('/api/auth/logout', (req, res) => {
  // Same custom header as dashboard actions, so another site can't sign you out.
  if (req.get('x-trap') !== '1') return res.status(403).json({ error: 'Missing request header.' });
  clearSession(req, res);
  res.json({ ok: true });
});

app.get(DASHBOARD_PATH, limit('page', 60e3, 120), (req, res) => {
  res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
  if (!isAuthed(req)) return res.type('html').send(renderLogin({ configured: Boolean(DASHBOARD_PASSWORD) }));
  res.type('html').send(renderDashboard({ ephemeral: EPHEMERAL_WARNING, weakPassword: DASHBOARD_PASSWORD.length < 12 }));
});

const admin = express.Router();
admin.use(requireAuth);

admin.get('/config', wrap(async (req, res) => res.json(await store.getConfig({ fresh: true }))));

admin.put('/config', wrap(async (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return res.status(400).json({ error: 'Invalid config.' });
  const next = req.body;
  // Give every link/button a stable id so clicks can be counted.
  for (const list of [next.links?.items, next.links?.buttons]) {
    if (Array.isArray(list)) for (const item of list) if (item && !item.id) item.id = crypto.randomBytes(5).toString('hex');
  }
  res.json(await store.setConfig(next));
}));

admin.get('/stats', wrap(async (req, res) => res.json(statsSummary(await store.getConfig({ fresh: true }), await store.getStats({ fresh: true })))));
admin.post('/stats/reset', wrap(async (req, res) => {
  await store.resetStats();
  res.json(statsSummary(await store.getConfig(), await store.getStats()));
}));

admin.get('/icons', (req, res) => res.set('Cache-Control', 'private, max-age=3600').json(iconSet(allIconRefs())));
admin.get('/effects', (req, res) => res.set('Cache-Control', 'private, max-age=3600').json(effectCatalog()));

admin.get('/discord/check', wrap(async (req, res) => {
  const id = String(req.query.id || '');
  if (!isSnowflake(id)) return res.json({ lanyard: { ok: false, error: 'Not a valid user ID.' }, profile: null });
  const [lanyard, profile] = await Promise.all([checkLanyard(id), getProfile(id)]);
  res.json({ lanyard, profile });
}));

// ---------- media library ----------
// Uploads arrive in parts (each under Vercel's 4.5 MB request limit): begin → part × n → finish.
admin.get('/media', wrap(async (req, res) => res.json(await store.listFiles())));

admin.post('/media/begin', (req, res) => {
  const size = Number(req.body?.size);
  const name = newName(req.body?.name);
  if (!name) return res.status(400).json({ error: 'Unsupported file type.' });
  if (!Number.isFinite(size) || size <= 0) return res.status(400).json({ error: 'Empty file.' });
  if (size > MAX_UPLOAD_MB * 1024 * 1024) return res.status(400).json({ error: `Files must be under ${MAX_UPLOAD_MB} MB.` });
  res.json({ name, partSize: PART_SIZE });
});

admin.put('/media/part/:name/:index', express.raw({ type: () => true, limit: PART_SIZE }), wrap(async (req, res) => {
  const index = Number(req.params.index);
  const parts = Math.ceil((MAX_UPLOAD_MB * 1024 * 1024) / PART_SIZE);
  if (!validName(req.params.name) || !Number.isInteger(index) || index < 0 || index >= parts || !Buffer.isBuffer(req.body)) {
    return res.status(400).json({ error: 'Bad upload part.' });
  }
  await store.writePart(req.params.name, index, req.body);
  res.json({ ok: true });
}));

admin.post('/media/finish', wrap(async (req, res) => {
  const { name, label, size } = req.body || {};
  if (!validName(name)) return res.status(400).json({ error: 'Bad upload.' });
  try {
    res.json(await store.finishFile(name, { label: String(label || name).slice(0, 120), size: Number(size) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}));

admin.delete('/media/part/:name', wrap(async (req, res) => {
  if (validName(req.params.name)) await store.abortFile(req.params.name);
  res.json({ ok: true });
}));

// Copy a file from another site into this one's storage ("Save to database").
admin.post('/media/fetch', wrap(async (req, res) => {
  try {
    res.json({ url: await downloadToLibrary(String(req.body?.url || '')) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}));

admin.delete('/media/:name', wrap(async (req, res) => {
  await store.removeFile(req.params.name);
  res.json({ ok: true });
}));

// ---------- backup / import ----------
admin.get('/export', wrap(async (req, res) => {
  const day = new Date().toISOString().slice(0, 10);
  res.set('Content-Disposition', `attachment; filename="trap-larp-backup-${day}.json"`);
  const config = await store.getConfig({ fresh: true });
  const stats = req.query.stats === '1' ? await store.getStats({ fresh: true }) : undefined;
  res.json({ kind: 'trap.larp-backup', v: 1, exportedAt: new Date().toISOString(), config, stats });
}));

admin.post('/import/backup', wrap(async (req, res) => {
  const body = req.body || {};
  const cfg = body.kind === 'trap.larp-backup' ? body.config : body;
  if (!cfg || typeof cfg !== 'object' || !cfg.profile) return res.status(400).json({ error: 'That file isn\'t a trap.larp backup.' });
  res.json(await store.setConfig(cfg));
}));

admin.get('/snapshots', wrap(async (req, res) => res.json(await store.listSnapshots())));
admin.post('/snapshots/restore', wrap(async (req, res) => {
  const snap = await store.readSnapshot(String(req.body?.name || ''));
  if (!snap) return res.status(404).json({ error: 'Snapshot not found.' });
  res.json(await store.setConfig(snap));
}));

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

// Keys like __proto__ would reach Object.prototype through `chosen[sec]`.
const SAFE_KEY = (k) => /^[A-Za-z][\w]*$/.test(k) && !['constructor', 'prototype'].includes(k);

admin.post('/import/guns/apply', wrap(async (req, res) => {
  const { patch = {}, sections = [], download = true } = req.body || {};
  const chosen = {};
  for (const key of sections) {
    const [sec, field] = String(key).split('.');
    if (!SAFE_KEY(sec) || !SAFE_KEY(field) || !Object.hasOwn(patch, sec) || !Object.hasOwn(patch[sec] || {}, field)) continue;
    if (patch[sec][field] !== undefined) (chosen[sec] ||= {})[field] = patch[sec][field];
  }
  // Each imported link needs an id for click stats.
  for (const item of chosen.links?.items || []) item.id ||= crypto.randomBytes(5).toString('hex');
  for (const item of chosen.links?.buttons || []) item.id ||= crypto.randomBytes(5).toString('hex');
  const downloads = download ? await localizeMedia(chosen) : [];
  const config = await store.setConfig(merge(await store.getConfig({ fresh: true }), chosen));
  res.json({ config, downloads });
}));

admin.use('/comments', adminComments);

app.use('/api/admin', admin);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
app.use((req, res) => res.redirect(302, '/'));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error('[server]', err);
  if (!res.headersSent) res.status(status).json({ error: status >= 500 ? store?.describeError?.(err) || 'Server error.' : err.message });
});
