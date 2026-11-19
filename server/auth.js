import crypto from 'node:crypto';
import { DASHBOARD_PASSWORD, SESSION_SECRET, SESSION_DAYS, USE_VERCEL } from './env.js';
import { store } from './store/index.js';
import { ipKey } from './analytics.js';

const COOKIE = 'tl_session';

// The signing key mixes a random secret kept in storage with the password. Without it, a session
// cookie or a comment form token (which anyone can get) would let someone test password guesses
// offline. Changing DASHBOARD_PASSWORD or SESSION_SECRET still signs everyone out.
let secret = null;
let ready = null;
let loadedAt = 0;
let refreshing = null;
const derive = (s) => crypto.createHash('sha256').update(`trap.larp|${s}|${SESSION_SECRET}|${DASHBOARD_PASSWORD}`).digest();
// Bumped on every rotation, so a read that started before one can't put the old key back.
let generation = 0;
const load = (fresh) => {
  const gen = generation;
  return store.serverSecret({ fresh }).then((s) => {
    if (gen !== generation) return;
    secret = derive(s);
    loadedAt = Date.now();
  });
};
// How often each server re-reads the key, so "Sign out everywhere" reaches all of Vercel's servers.
const REFRESH_MS = 60e3;

export function authReady() {
  ready ||= load(false).catch((err) => {
    ready = null;
    throw err;
  });
  if (secret && !refreshing && Date.now() - loadedAt > REFRESH_MS) {
    refreshing = load(true).catch(() => {}).finally(() => { refreshing = null; });
  }
  return ready;
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const hmac = (data) => {
  if (!secret) throw new Error('Signing key not loaded yet.');
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
};
// Signs short values (like comment form tokens) with the same server secret as logins.
export const sign = hmac;
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();

export function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function isAuthed(req) {
  if (!DASHBOARD_PASSWORD || !secret) return false;
  const raw = parseCookies(req)[COOKIE];
  if (!raw) return false;
  const [payload, sig] = raw.split('.');
  if (!payload || !sig) return false;
  const expected = hmac(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return Number(exp) > Date.now();
  } catch {
    return false;
  }
}

function setSession(req, res) {
  const exp = Date.now() + SESSION_DAYS * 864e5;
  const payload = b64url(JSON.stringify({ exp, n: crypto.randomBytes(8).toString('hex') }));
  const parts = [`${COOKIE}=${payload}.${hmac(payload)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${SESSION_DAYS * 86400}`];
  if (req.secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSession(req, res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${req.secure ? '; Secure' : ''}`);
}

// Brute-force protection: 8 attempts per 15 minutes per IP (IPv6 counted per /64, so hopping
// between addresses doesn't reset the count), and 100 per 15 minutes for the whole site, against
// guesses spread over many addresses. Both counters live in the store and are updated atomically,
// so parallel guesses can't slip past them, and they hold across Vercel's short-lived servers too.
const WINDOW = 15 * 60 * 1000;
const PER_IP = 8;
const SITE_WIDE = 100;
const minutes = (seconds) => Math.max(1, Math.ceil(seconds / 60));

export async function login(req, res) {
  if (!DASHBOARD_PASSWORD) {
    return res.status(503).json({ error: `DASHBOARD_PASSWORD is not set on the server. Add it in your ${USE_VERCEL ? 'Vercel' : 'Railway'} variables and redeploy.` });
  }
  const mine = await store.hit('login', ipKey(req.ip) || 'unknown', WINDOW, PER_IP);
  if (!mine.ok) return res.status(429).json({ error: `Too many attempts. Try again in ${minutes(mine.retryIn)} min.` });
  const all = await store.hit('login-all', 'all', WINDOW, SITE_WIDE);
  if (!all.ok) return res.status(429).json({ error: `Too many sign-in attempts on this site right now. Try again in ${minutes(all.retryIn)} min.` });
  const given = sha(req.body?.password ?? '');
  if (!crypto.timingSafeEqual(given, sha(DASHBOARD_PASSWORD))) return res.status(401).json({ error: 'Wrong password.' });
  // Sign with the newest key, in case "Sign out everywhere" was used on another server.
  await load(true);
  setSession(req, res);
  res.json({ ok: true });
}

// Replaces the signing key, so every login cookie (on every device) stops working. Other servers
// pick the new key up within REFRESH_MS.
export async function signOutEverywhere(req, res) {
  generation += 1;
  secret = derive(await store.rotateSecret());
  loadedAt = Date.now();
  clearSession(req, res);
  res.json({ ok: true });
}

export function requireAuth(req, res, next) {
  if (!isAuthed(req)) return res.status(401).json({ error: 'Not signed in.' });
  // Mutating requests must carry a custom header, which cross-site forms cannot send.
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.get('x-trap') !== '1') {
    return res.status(403).json({ error: 'Missing request header.' });
  }
  next();
}
