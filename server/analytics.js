import crypto from 'node:crypto';
import net from 'node:net';
import { store } from './store/index.js';

const BOT_RE = /bot|crawl|spider|slurp|preview|embed|facebookexternalhit|whatsapp|curl|wget|python|node-fetch|axios|headless|lighthouse|monitor/i;

const day = (d = new Date()) => d.toISOString().slice(0, 10);
const inc = (obj, key, n = 1) => { obj[key] = (obj[key] || 0) + n; };

function device(ua) {
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return 'tablet';
  if (/mobi|iphone|android/i.test(ua)) return 'mobile';
  return 'desktop';
}

function browser(ua) {
  if (/edg\//i.test(ua)) return 'Edge';
  if (/opr\/|opera/i.test(ua)) return 'Opera';
  if (/firefox|fxios/i.test(ua)) return 'Firefox';
  if (/samsungbrowser/i.test(ua)) return 'Samsung';
  if (/chrome|crios/i.test(ua)) return 'Chrome';
  if (/safari/i.test(ua)) return 'Safari';
  return 'Other';
}

function refHost(ref, selfHost) {
  if (!ref) return 'direct';
  try {
    const h = new URL(ref).hostname.replace(/^www\./, '');
    if (!h || h === selfHost) return null;
    return h;
  } catch {
    return 'direct';
  }
}

// One visitor = one network address. IPv6 hosts are normally handed a whole /64 and can hop
// between addresses inside it at will, so the /64 counts as one visitor.
function ipKey(ip) {
  ip = String(ip || '').replace(/%.*$/, '');
  const v4 = /^(?:::ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (v4) return v4[1];
  if (!net.isIPv6(ip)) return ip;
  const groups = (s) => (s ? s.split(':') : []).flatMap((g) => (g.includes('.') ? ['0', '0'] : [g]));
  const [head, tail] = ip.split('::');
  const h = groups(head);
  const t = groups(tail);
  const full = tail === undefined ? h : [...h, ...Array(8 - h.length - t.length).fill('0'), ...t];
  return full.slice(0, 4).map((g) => parseInt(g, 16).toString(16)).join(':') + '::/64';
}

export async function recordView(req, { referrer, cooldownMinutes }) {
  const ua = String(req.get('user-agent') || '');
  if (!ua || BOT_RE.test(ua)) return { counted: false };
  const ip = ipKey(req.ip);
  if (!ip) return { counted: false };
  const windowMs = Math.max(1, Number(cooldownMinutes) || 30) * 6e4;
  const now = Date.now();
  const today = day();
  const country = String(req.get('cf-ipcountry') || req.get('x-vercel-ip-country') || '').toUpperCase().slice(0, 2);
  const host = refHost(referrer, req.hostname);
  return store.visit(async ({ stats: s, getVisitor, setVisitor }) => {
    // Visitors are stored only as salted hashes; the salt lives with the stats.
    s.salt ||= crypto.randomBytes(16).toString('hex');
    const hash = (v) => crypto.createHash('sha256').update(`${s.salt}|${v}`).digest('base64url').slice(0, 16);
    const visitor = hash(ip);
    const last = await getVisitor(visitor, hash(`${req.ip || ''}|${ua}`));
    // Each visitor counts once per cooldown window, so reloading or clearing cookies can't inflate the numbers.
    if (last?.at && now - last.at < windowMs) return { counted: false };
    const isNew = !last;
    s.total += 1;
    s.daily[today] ||= { v: 0, u: 0 };
    s.daily[today].v += 1;
    if (isNew) {
      s.unique += 1;
      inc(s.devices, device(ua));
      inc(s.browsers, browser(ua));
      if (country) inc(s.countries, country);
    }
    if (last?.day !== today) s.daily[today].u += 1;
    setVisitor(visitor, { day: today, at: now });
    if (host) inc(s.referrers, host);
    s.recent.unshift({ t: now, r: host || 'direct', d: device(ua), b: browser(ua), n: isNew, c: country || undefined });
    s.recent.length = Math.min(s.recent.length, 60);
    return { counted: true, isNew };
  });
}

export async function recordClick(id) {
  const key = String(id || '').slice(0, 80);
  if (!key) return;
  await store.updateStats((s) => inc(s.clicks, key));
}

export function viewCount(config, s) {
  const base = config.views?.mode === 'total' ? s.total : s.unique;
  return base + (Number(config.views?.offset) || 0);
}

export function statsSummary(config, s) {
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = day(new Date(Date.now() - i * 864e5));
    days.push({ day: d, views: s.daily[d]?.v || 0, unique: s.daily[d]?.u || 0 });
  }
  const top = (obj, n = 8) => Object.entries(obj || {}).sort((a, b) => b[1] - a[1]).slice(0, n);
  const sum = (arr, k) => arr.reduce((a, b) => a + b[k], 0);
  return {
    total: s.total,
    unique: s.unique,
    displayed: viewCount(config, s),
    today: days[days.length - 1],
    week: { views: sum(days.slice(-7), 'views'), unique: sum(days.slice(-7), 'unique') },
    month: { views: sum(days, 'views'), unique: sum(days, 'unique') },
    days,
    referrers: top(s.referrers),
    clicks: top(s.clicks, 20),
    devices: top(s.devices),
    browsers: top(s.browsers),
    countries: top(s.countries),
    recent: s.recent.slice(0, 25),
  };
}
