import crypto from 'node:crypto';
import { DASHBOARD_PASSWORD, SESSION_SECRET, SESSION_DAYS, USE_VERCEL } from './env.js';
import { store } from './store/index.js';

const COOKIE = 'tl_session';
// Changing DASHBOARD_PASSWORD (or SESSION_SECRET) signs everyone out.
const secret = crypto.createHash('sha256').update(`trap.larp|${SESSION_SECRET}|${DASHBOARD_PASSWORD}`).digest();

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const hmac = (data) => crypto.createHmac('sha256', secret).update(data).digest('base64url');
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
  if (!DASHBOARD_PASSWORD) return false;
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

// Brute-force protection: 8 failures per 15 minutes per IP, kept in the store so it holds
// across Vercel's short-lived servers too.
const WINDOW = 15 * 60 * 1000;

export async function login(req, res) {
  if (!DASHBOARD_PASSWORD) {
    return res.status(503).json({ error: `DASHBOARD_PASSWORD is not set on the server. Add it in your ${USE_VERCEL ? 'Vercel' : 'Railway'} variables and redeploy.` });
  }
  const ip = req.ip || 'unknown';
  const now = Date.now();
  let rec = await store.getLogin(ip);
  if (!rec || now - rec.first > WINDOW) rec = { n: 0, first: now };
  if (rec.n >= 8) {
    const wait = Math.ceil((rec.first + WINDOW - now) / 60000);
    return res.status(429).json({ error: `Too many attempts. Try again in ${wait} min.` });
  }
  const given = sha(req.body?.password ?? '');
  if (!crypto.timingSafeEqual(given, sha(DASHBOARD_PASSWORD))) {
    await store.setLogin(ip, { n: rec.n + 1, first: rec.first });
    return res.status(401).json({ error: 'Wrong password.' });
  }
  if (rec.n) await store.setLogin(ip, null);
  setSession(req, res);
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
