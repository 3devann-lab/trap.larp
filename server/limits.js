// Per-IP request limits kept in memory. They need no database, so a flood is turned away before
// it costs any database reads or writes (on Vercel that's what would burn Firestore's free
// daily quota). Each server counts on its own, which is plenty to stop a single source.
import { ipKey } from './analytics.js';

const hits = new Map();

export function allow(name, key, windowMs, max) {
  const id = `${name}|${key}`;
  const now = Date.now();
  let rec = hits.get(id);
  if (!rec || now - rec.start >= windowMs) rec = { start: now, n: 0, windowMs };
  rec.n += 1;
  hits.set(id, rec);
  if (hits.size > 50000) for (const [k, r] of hits) if (now - r.start >= r.windowMs) hits.delete(k);
  return { ok: rec.n <= max, retryIn: Math.max(1, Math.ceil((rec.start + windowMs - now) / 1000)) };
}

// Express middleware: at most `max` requests per `windowMs` from one IP (IPv6 counted per /64).
export const limit = (name, windowMs, max) => (req, res, next) => {
  const r = allow(name, ipKey(req.ip) || 'unknown', windowMs, max);
  if (r.ok) return next();
  res.set('Retry-After', String(r.retryIn));
  if (req.path.startsWith('/api/') || req.baseUrl.startsWith('/api')) return res.status(429).json({ error: 'Too many requests. Slow down a little.' });
  res.status(429).type('text/plain').send('Too many requests. Try again in a minute.');
};
