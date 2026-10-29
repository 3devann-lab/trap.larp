// Visitor comments: one per IP, 200 characters, an optional PNG/JPEG/WebP picture up to 3 MB.
// Everything a visitor sends is checked here; the page only ever shows it as plain text.
import crypto from 'node:crypto';
import express from 'express';
import { store } from './store/index.js';
import { ipKey } from './analytics.js';
import { sign, isAuthed } from './auth.js';

export const MAX_TEXT = 200;
export const MAX_AVATAR_BYTES = 3 * 1024 * 1024;
const MAX_AVATAR_SIDE = 2048;
const PAGE = 20;

// ---------- limits (per IP unless noted) ----------
const LIMITS = {
  post: [10 * 60e3, 5], // attempts to post, including rejected ones
  postAll: [60 * 60e3, 60], // new comments site-wide, against floods from many IPs
  read: [60e3, 120], // comment list and pictures (a page of comments is up to 21 requests)
};
// Reads are limited per server in memory, so browsing comments doesn't spend database writes.
const readHits = new Map();
function readLimit(key) {
  const [windowMs, max] = LIMITS.read;
  const now = Date.now();
  let rec = readHits.get(key);
  if (!rec || now - rec.start >= windowMs) rec = { start: now, n: 0 };
  rec.n += 1;
  readHits.set(key, rec);
  if (readHits.size > 20000) for (const [k, r] of readHits) if (now - r.start > windowMs) readHits.delete(k);
  return rec.n <= max;
}

// ---------- text ----------
// Removes invisible and direction-flipping characters (keeping the joiner emoji need), stacks of
// accents ("zalgo"), and line breaks; then trims and squeezes spaces.
function clean(value) {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/(?!‍)[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ')
    .replace(/(\p{M}{2})\p{M}+/gu, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
const length = (s) => [...s].length;

// ---------- pictures ----------
// The type comes from the file's bytes, never its name. GIF, SVG, video and animated PNG/WebP
// don't match; huge dimensions are refused so a small file can't freeze visitors' phones.
export function sniffImage(buf) {
  if (buf.length < 32) return null;
  if (buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(4) === 0x0d0a1a0a) {
    for (let off = 8; off + 8 <= buf.length;) {
      const len = buf.readUInt32BE(off);
      const type = buf.toString('latin1', off + 4, off + 8);
      if (type === 'acTL') return null; // animated PNG
      if (type === 'IDAT') break;
      off += 12 + len;
    }
    return { type: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    for (let off = 2; off + 9 < buf.length;) {
      if (buf[off] !== 0xff) { off++; continue; }
      const marker = buf[off + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { type: 'jpg', width: buf.readUInt16BE(off + 7), height: buf.readUInt16BE(off + 5) };
      }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { off += 2; continue; }
      off += 2 + buf.readUInt16BE(off + 2);
    }
    return null;
  }
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') {
    let size = null;
    for (let off = 12; off + 8 <= buf.length;) {
      const type = buf.toString('latin1', off, off + 4);
      const len = buf.readUInt32LE(off + 4);
      const d = off + 8;
      if (type === 'ANIM' || type === 'ANMF') return null; // animated WebP
      if (type === 'VP8X') {
        if (buf[d] & 0x02) return null;
        size ||= { width: buf.readUIntLE(d + 4, 3) + 1, height: buf.readUIntLE(d + 7, 3) + 1 };
      } else if (type === 'VP8 ' && d + 10 <= buf.length) {
        size ||= { width: buf.readUInt16LE(d + 6) & 0x3fff, height: buf.readUInt16LE(d + 8) & 0x3fff };
      } else if (type === 'VP8L' && d + 5 <= buf.length) {
        const bits = buf.readUInt32LE(d + 1);
        size ||= { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
      off = d + len + (len & 1);
    }
    return size && { type: 'webp', ...size };
  }
  return null;
}
const AVATAR_TYPES = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };
const validAvatar = (name) => /^[\w-]{12}\.(png|jpg|webp)$/.test(String(name || ''));

// ---------- form tokens ----------
// Handed out with the comment list and required to post: signed for this IP, and only valid
// from 3 seconds to 2 hours after it was issued, which stops one-shot scripted posts.
const tokenFor = (ip, ts = Date.now()) => `${ts}.${sign(`comment|${ts}|${ip}`)}`;
function tokenOk(token, ip) {
  const [ts, sig] = String(token || '').split('.');
  const age = Date.now() - Number(ts);
  if (!sig || !(age >= 3000 && age <= 2 * 3600e3)) return false;
  const expected = tokenFor(ip, Number(ts)).split('.')[1];
  return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

const ipHash = async (ip) => crypto.createHash('sha256').update(`${await store.commentSalt()}|${ip}`).digest('base64url').slice(0, 24);
const toPublic = (c) => ({ id: c.id, at: c.at, username: c.username, name: c.name, text: c.text, avatar: c.avatar ? `/api/comments/avatar/${c.avatar}` : null });

// ---------- routes ----------
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const deny = (res, status, error, retryIn) => {
  if (retryIn) res.set('Retry-After', String(retryIn));
  return res.status(status).json({ error });
};

export const publicComments = express.Router();

// Off means off for visitors; the signed-in owner can still see them to moderate.
publicComments.use(wrap(async (req, res, next) => {
  if (!(await store.getConfig()).comments.enabled && !isAuthed(req)) return deny(res, 404, 'Comments are off.');
  res.set('Cache-Control', 'no-store');
  next();
}));

publicComments.get('/', wrap(async (req, res) => {
  const ip = ipKey(req.ip);
  if (!readLimit(ip)) return deny(res, 429, 'Slow down a little.', 60);
  const before = Number(req.query.before) || undefined;
  const [page, mine] = await Promise.all([store.listComments({ limit: PAGE, before }), store.hasCommented(await ipHash(ip))]);
  res.json({ comments: page.comments.map(toPublic), more: page.more, canPost: !mine, token: tokenFor(ip) });
}));

publicComments.get('/avatar/:name', wrap(async (req, res) => {
  if (!validAvatar(req.params.name)) return res.status(404).end();
  if (!readLimit(ipKey(req.ip))) return res.status(429).end();
  const buf = await store.getAvatar(req.params.name);
  if (!buf) return res.status(404).end();
  res.set({
    'Content-Type': AVATAR_TYPES[req.params.name.split('.').pop()],
    'Content-Security-Policy': "sandbox; default-src 'none'",
    'Cache-Control': 'public, max-age=3600',
    // Short CDN cache, so a deleted comment's picture stops being served soon after.
    'CDN-Cache-Control': 'public, max-age=3600',
  });
  res.end(buf);
}));

publicComments.post('/', wrap(async (req, res) => {
  // A custom header can't be sent cross-site without a CORS preflight, which this server never
  // allows; the Origin check covers browsers that send it anyway.
  const origin = req.get('origin');
  if (req.get('x-trap-comment') !== '1' || (origin && origin !== `${req.protocol}://${req.get('host')}`)) return deny(res, 403, 'Not allowed.');
  const ip = ipKey(req.ip);
  if (!ip) return deny(res, 400, 'Could not post.');
  const limit = await store.hit('comment-post', ip, ...LIMITS.post);
  if (!limit.ok) return deny(res, 429, `Too many tries. Wait ${Math.ceil(limit.retryIn / 60)} min.`, limit.retryIn);

  const body = req.body || {};
  if (body.homepage) return deny(res, 400, 'Could not post.'); // honeypot field real visitors never see
  if (!tokenOk(body.token, ip)) return deny(res, 400, 'The form expired or was sent too fast. Reload and try again.');

  const name = clean(body.name);
  const username = clean(body.username).replace(/^@/, '');
  const text = clean(body.text);
  if (!name || length(name) > 32) return deny(res, 400, 'Display name must be 1–32 characters.');
  if (!/^[A-Za-z0-9_.]{2,24}$/.test(username)) return deny(res, 400, 'Username must be 2–24 letters, numbers, _ or .');
  if (!text) return deny(res, 400, 'Write a message first.');
  if (length(text) > MAX_TEXT) return deny(res, 400, `Messages can be at most ${MAX_TEXT} characters.`);
  const { profile } = await store.getConfig();
  const owner = [profile.username, profile.displayName].map((v) => String(v || '').trim().toLowerCase()).filter(Boolean);
  if (owner.includes(username.toLowerCase()) || owner.includes(name.toLowerCase())) return deny(res, 400, 'That name belongs to the owner of this page.');

  let avatar = null;
  if (body.avatar) {
    const buf = Buffer.from(String(body.avatar), 'base64');
    if (buf.length > MAX_AVATAR_BYTES) return deny(res, 400, 'Pictures can be at most 3 MB.');
    const img = sniffImage(buf);
    if (!img) return deny(res, 400, 'Pictures must be PNG, JPEG or WebP (no GIFs, animations or videos).');
    if (!img.width || !img.height || img.width > MAX_AVATAR_SIDE || img.height > MAX_AVATAR_SIDE) return deny(res, 400, `Pictures can be at most ${MAX_AVATAR_SIDE}×${MAX_AVATAR_SIDE} pixels.`);
    avatar = { buf, type: img.type };
  }

  const hash = await ipHash(ip);
  if (await store.hasCommented(hash)) return deny(res, 409, 'You already left a comment here.');
  const all = await store.hit('comment-post-all', 'all', ...LIMITS.postAll);
  if (!all.ok) return deny(res, 429, 'Lots of comments right now. Try again later.', all.retryIn);

  const id = crypto.randomBytes(9).toString('base64url');
  const comment = { id, at: Date.now(), username, name, text, avatar: avatar ? `${id}.${avatar.type}` : null };
  if (avatar) await store.putAvatar(comment.avatar, avatar.buf);
  if (!(await store.addComment(comment, hash))) {
    if (avatar) await store.removeAvatar(comment.avatar);
    return deny(res, 409, 'You already left a comment here.');
  }
  res.status(201).json(toPublic(comment));
}));

// ---------- dashboard ----------
export const adminComments = express.Router();

adminComments.get('/', wrap(async (req, res) => {
  const page = await store.listComments({ limit: 50, before: Number(req.query.before) || undefined });
  res.json({ comments: page.comments.map(toPublic), more: page.more });
}));

adminComments.delete('/:id', wrap(async (req, res) => {
  if (!/^[\w-]{12}$/.test(req.params.id)) return res.status(400).json({ error: 'Bad id.' });
  const removed = await store.removeComment(req.params.id);
  if (removed?.avatar) await store.removeAvatar(removed.avatar);
  res.json({ ok: Boolean(removed) });
}));
