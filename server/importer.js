// Turns data collected from a guns.lol profile (by the transfer bookmarklet) into trap.larp settings,
// and downloads remote media into the local media library.
import path from 'node:path';
import dns from 'node:dns/promises';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { MAX_UPLOAD_MB } from './env.js';
import { store } from './store/index.js';
import { EXT_BY_TYPE, PART_SIZE, newName } from './media.js';
import { platformFromName, platformFromUrl } from '../shared/platforms.js';
import { GUNS_BADGE_MAP, badgePreset } from '../shared/badges.js';
import { getPath, setPath } from '../shared/schema.js';

const norm = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

// ---------- value helpers ----------
function toHex(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return '#' + (v >>> 0 & 0xffffff).toString(16).padStart(6, '0');
  const s = String(v).trim();
  let m = s.match(/^#?([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (m) return '#' + m[1].toLowerCase();
  m = s.match(/^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (m) return '#' + m.slice(1).map((c) => c + c).join('').toLowerCase();
  m = s.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i);
  if (m) return '#' + m.slice(1, 4).map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0')).join('');
  return null;
}

function absUrl(v) {
  if (typeof v !== 'string' || !v.trim()) return null;
  const s = v.trim();
  if (s.startsWith('data:')) return null;
  try {
    const u = new URL(s, 'https://guns.lol/');
    return /^https?:$/.test(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}

const VIDEO_RE = /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i;
const AUDIO_RE = /\.(mp3|ogg|wav|m4a|aac|flac|opus|weba)(\?|#|$)/i;
const percent = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(Math.max(0, Math.min(100, n <= 1 ? n * 100 : n)));
};
const bool = (v) => (typeof v === 'boolean' ? v : v === 1 || v === '1' || v === 'true' ? true : v === 0 || v === '0' || v === 'false' ? false : null);

// Index every key in the collected objects so we can look values up by any spelling.
function buildIndex(candidates) {
  const index = new Map(); // normKey → [{ value, depth, rank }]
  candidates.forEach((root, rank) => {
    const walk = (node, depth) => {
      if (!node || typeof node !== 'object' || depth > 8) return;
      if (Array.isArray(node)) { node.forEach((x) => walk(x, depth + 1)); return; }
      for (const [k, v] of Object.entries(node)) {
        const nk = norm(k);
        if (!index.has(nk)) index.set(nk, []);
        index.get(nk).push({ value: v, depth, rank, parent: node });
        if (isObj(v) || Array.isArray(v)) walk(v, depth + 1);
      }
    };
    walk(root, 0);
  });
  for (const list of index.values()) list.sort((a, b) => a.rank - b.rank || a.depth - b.depth);
  return index;
}

function pick(index, keys, { maxDepth = 8, accept = (v) => v != null && v !== '' } = {}) {
  for (const k of keys) {
    for (const hit of index.get(norm(k)) || []) {
      if (hit.depth <= maxDepth && accept(hit.value)) return hit.value;
    }
  }
  return undefined;
}

const str = (v) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : undefined);
const urlOf = (v) => {
  if (typeof v === 'string') return absUrl(v);
  if (isObj(v)) return absUrl(v.url || v.src || v.href || v.link || v.file || '');
  return null;
};

function parseSocials(raw) {
  const out = [];
  const push = (platformName, value, extra = {}) => {
    const val = str(value)?.trim();
    if (!val) return;
    let platform = platformFromName(platformName);
    if (!platform && /^https?:/i.test(val)) platform = platformFromUrl(val);
    out.push({ platform: platform || (/^https?:/i.test(val) ? 'link' : 'copy'), value: val, label: extra.label || '', icon: extra.icon || '', color: '' });
  };
  if (Array.isArray(raw)) {
    for (const s of raw) {
      if (typeof s === 'string') { push(platformFromUrl(s), s); continue; }
      if (!isObj(s)) continue;
      const name = s.social ?? s.platform ?? s.type ?? s.name ?? s.id ?? s.service ?? s.key;
      const value = s.value ?? s.username ?? s.url ?? s.link ?? s.handle ?? s.href ?? s.content;
      push(name, value, { label: str(s.label || s.title || s.tooltip) || '', icon: urlOf(s.icon || s.image || s.custom_icon) || '' });
    }
  } else if (isObj(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      if (isObj(v)) push(k, v.value ?? v.username ?? v.url ?? v.link);
      else push(k, v);
    }
  }
  return out;
}

const prettify = (s) => String(s).replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function parseBadges(raw) {
  const list = Array.isArray(raw) ? raw : isObj(raw) ? Object.entries(raw).filter(([, v]) => v === true || isObj(v)).map(([k, v]) => (isObj(v) ? { name: k, ...v } : k)) : [];
  const out = [];
  for (const b of list) {
    const name = typeof b === 'string' ? b : str(b?.name ?? b?.id ?? b?.badge ?? b?.type ?? b?.title);
    if (!name) continue;
    if (isObj(b) && (b.enabled === false || b.hidden === true || b.visible === false)) continue;
    const key = norm(name).replace(/(\d{4})$/, '_$1');
    const presetId = GUNS_BADGE_MAP[name.toLowerCase()] || GUNS_BADGE_MAP[key] || GUNS_BADGE_MAP[norm(name)] || 'sparkles';
    const preset = badgePreset(presetId);
    out.push({
      preset: presetId,
      label: str(b?.description ?? b?.label ?? b?.tooltip) || (presetId === 'sparkles' && !GUNS_BADGE_MAP[norm(name)] ? prettify(name) : preset?.label || prettify(name)),
      color: toHex(b?.color) || '',
      image: isObj(b) ? urlOf(b.icon || b.image || b.icon_url || b.url) || '' : '',
    });
  }
  return out;
}

function parseTracks(raw) {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const out = [];
  for (const a of list) {
    const url = urlOf(a);
    if (!url) continue;
    out.push({
      url,
      title: isObj(a) ? str(a.title ?? a.name ?? a.song) || '' : '',
      artist: isObj(a) ? str(a.artist ?? a.author) || '' : '',
      cover: isObj(a) ? urlOf(a.cover || a.image || a.thumbnail) || '' : '',
    });
  }
  return out;
}

function lowerList(v) {
  if (Array.isArray(v)) return v.map((x) => String(isObj(x) ? x.name || x.id || x.type || '' : x).toLowerCase());
  if (isObj(v)) return Object.entries(v).filter(([, x]) => x === true || (isObj(x) && x.enabled !== false)).map(([k]) => k.toLowerCase());
  if (typeof v === 'string') return v.toLowerCase().split(/[,|]/).map((s) => s.trim());
  return [];
}

// ---------- main normalizer ----------
export function normalizeGuns(payload) {
  if (!isObj(payload)) throw new Error('That doesn\'t look like transfer data.');
  const candidates = (Array.isArray(payload.candidates) ? payload.candidates : []).filter(isObj);
  const idx = buildIndex(candidates);
  const page = isObj(payload.page) ? payload.page : {};
  const media = isObj(payload.media) ? payload.media : {};
  const links = Array.isArray(payload.links) ? payload.links : [];
  const patch = {};
  const found = [];
  const set = (key, value, label) => {
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) return;
    setPath(patch, key, value);
    if (label) found.push({ key, label, value: typeof value === 'string' || typeof value === 'number' ? value : Array.isArray(value) ? `${value.length} item(s)` : 'yes' });
  };
  const sPick = (keys, opts) => str(pick(idx, keys, { ...opts, accept: (v) => typeof v === 'string' ? v.trim() !== '' : typeof v === 'number' }));

  // Identity
  const username = sPick(['username', 'user_name', 'alias', 'slug'], { maxDepth: 3 }) || payload.user;
  set('profile.username', username, 'Handle');
  set('profile.displayName', sPick(['display_name', 'displayname', 'nickname'], { maxDepth: 3 }) || page.h1 || username, 'Display name');
  const bio = sPick(['description', 'bio', 'about', 'about_me'], { maxDepth: 4 }) || page.ogDescription;
  set('profile.bio', bio, 'Bio');
  set('profile.location', sPick(['location', 'country', 'city']), 'Location');
  const uid = pick(idx, ['uid'], { maxDepth: 3, accept: (v) => /^\d{1,12}$/.test(String(v)) });
  set('profile.uid', uid != null ? String(uid) : undefined, 'UID');

  // Avatar
  let avatar = urlOf(pick(idx, ['avatar_url', 'avatarurl', 'avatar', 'pfp', 'profile_picture', 'profilepicture', 'avatar_image'], { accept: (v) => Boolean(urlOf(v)) }));
  if (!avatar) avatar = (media.images || []).find((i) => /avatar|pfp|profile/i.test(`${i.alt} ${i.hint}`))?.src || null;
  if (avatar) { set('profile.avatar', avatar, 'Avatar'); set('profile.avatarSource', 'custom'); }
  const useDiscordAvatar = bool(pick(idx, ['use_discord_avatar', 'discord_avatar', 'usediscordavatar'], { accept: (v) => bool(v) !== null }));
  if (useDiscordAvatar) set('profile.avatarSource', 'discord', 'Use Discord avatar');

  // Background
  let bg = urlOf(pick(idx, ['background_url', 'backgroundurl', 'background', 'background_image', 'background_video', 'bg', 'bg_url'], { accept: (v) => Boolean(urlOf(v)) }));
  if (!bg) bg = (media.videos || [])[0] || (media.backgrounds || []).find((u) => !AUDIO_RE.test(u)) || null;
  if (bg) {
    if (VIDEO_RE.test(bg)) { set('bg.type', 'video'); set('bg.video', bg, 'Background video'); } else { set('bg.type', 'image'); set('bg.image', bg, 'Background image'); }
  } else {
    const bgColor = toHex(pick(idx, ['background_color', 'backgroundcolor', 'bg_color']));
    if (bgColor) { set('bg.type', 'color'); set('bg.color', bgColor, 'Background color'); }
  }
  const banner = urlOf(pick(idx, ['banner_url', 'banner'], { accept: (v) => Boolean(urlOf(v)) }));
  if (banner) { set('profile.bannerSource', 'custom'); set('profile.banner', banner, 'Banner'); }

  // Audio
  let tracks = parseTracks(pick(idx, ['audios', 'audio', 'audio_url', 'audiourl', 'songs', 'tracks', 'music'], { accept: (v) => parseTracks(v).length > 0 }));
  if (!tracks.length) tracks = (media.audios || []).map((url) => ({ url, title: '', artist: '', cover: '' }));
  if (tracks.length) {
    for (const t of tracks) if (!t.title) t.title = decodeURIComponent(t.url.split('/').pop().split('?')[0]).replace(AUDIO_RE, '').replace(/[_-]+/g, ' ').slice(0, 80);
    set('audio.tracks', tracks, 'Music');
  }
  const volumeControl = bool(pick(idx, ['volume_control', 'volumecontrol'], { accept: (v) => bool(v) !== null }));
  if (volumeControl !== null) set('audio.showVolume', volumeControl);

  // Cursor
  const cursor = urlOf(pick(idx, ['cursor_url', 'cursorurl', 'cursor', 'custom_cursor'], { accept: (v) => Boolean(urlOf(v)) })) || absUrl(media.cursor || '');
  if (cursor) { set('cursor.type', 'custom'); set('cursor.image', cursor, 'Custom cursor'); }

  // Colors & card
  const accent = toHex(pick(idx, ['accent_color', 'accentcolor', 'accent', 'profile_color', 'theme_color', 'primary_color'])) || toHex(page.themeColor);
  if (accent) {
    set('look.accent', accent, 'Accent color');
    set('name.glowColor', accent);
    set('fx.clickColor', accent);
  }
  set('look.textColor', toHex(pick(idx, ['text_color', 'textcolor'])), 'Text color');
  set('look.iconColor', toHex(pick(idx, ['icon_color', 'iconcolor', 'social_color'])), 'Icon color');
  const opacity = percent(pick(idx, ['profile_opacity', 'profileopacity', 'card_opacity', 'box_opacity', 'opacity'], { accept: (v) => Number.isFinite(Number(v)) }));
  if (opacity !== null) set('look.cardOpacity', opacity, 'Card opacity');
  const blur = Number(pick(idx, ['profile_blur', 'profileblur', 'card_blur', 'blur'], { accept: (v) => Number.isFinite(Number(v)) }));
  if (Number.isFinite(blur)) set('look.cardBlur', Math.max(0, Math.min(40, Math.round(blur))), 'Card blur');

  // Effects
  const nameFx = lowerList(pick(idx, ['username_effects', 'usernameeffects', 'username_effect', 'name_effect']));
  if (nameFx.some((e) => e.includes('rainbow'))) set('name.effect', 'rainbow', 'Username effect');
  else if (nameFx.some((e) => e.includes('typewriter'))) set('name.effect', 'typewriter', 'Username effect');
  else if (nameFx.some((e) => e.includes('glitch'))) set('name.effect', 'glitch', 'Username effect');
  else if (nameFx.some((e) => e.includes('gradient'))) set('name.effect', 'gradient', 'Username effect');
  if (nameFx.some((e) => e.includes('sparkle'))) {
    set('name.sparkles', true, 'Username sparkles');
    const color = nameFx.join(' ').match(/sparkles?[_ -]?(white|green|pink|red|yellow|blue|purple|black)/)?.[1];
    const named = { white: '#ffffff', green: '#4ade80', pink: '#f472b6', red: '#ef4444', yellow: '#facc15', blue: '#60a5fa', purple: '#a855f7', black: '#111111' };
    if (color) set('name.sparkleColor', named[color]);
  }
  const glowName = bool(pick(idx, ['glow_username', 'username_glow', 'glowusername'], { accept: (v) => bool(v) !== null }));
  if (glowName !== null) set('name.glow', glowName, 'Username glow');
  if (nameFx.some((e) => e.includes('glow'))) set('name.glow', true);
  const glowSocials = bool(pick(idx, ['glow_socials', 'socials_glow', 'glowsocials'], { accept: (v) => bool(v) !== null }));
  if (glowSocials !== null) set('links.glow', glowSocials);
  const glowBadges = bool(pick(idx, ['glow_badges', 'badges_glow', 'glowbadges'], { accept: (v) => bool(v) !== null }));
  if (glowBadges !== null) set('badges.glow', glowBadges);
  const mono = bool(pick(idx, ['monochrome_icons', 'monochromeicons', 'monochrome'], { accept: (v) => bool(v) !== null }));
  if (mono !== null) set('links.colorMode', mono ? 'mono' : 'brand', 'Icon color mode');

  const bgFx = lowerList(pick(idx, ['background_effects', 'backgroundeffects', 'background_effect', 'bg_effect', 'effects']));
  const has = (re) => bgFx.some((e) => re.test(e));
  if (has(/snow/)) set('fx.particles', 'snow', 'Background effect');
  else if (has(/rain/)) set('fx.particles', 'rain', 'Background effect');
  else if (has(/star/)) set('fx.particles', 'stars', 'Background effect');
  else if (has(/heart/)) set('fx.particles', 'hearts', 'Background effect');
  else if (bgFx.length) set('fx.particles', 'none');
  if (has(/blur/)) set('bg.blur', 10);
  if (has(/old ?tv|tv|vhs|crt/)) { set('fx.vhs', true, 'Old TV effect'); set('fx.scanlines', true); }
  if (has(/night/)) set('fx.tint', 'night', 'Night filter');

  const tilt = bool(pick(idx, ['tilt', 'profile_tilt', 'animated_profile', 'animation'], { accept: (v) => bool(v) !== null }));
  if (tilt !== null) set('look.tilt', tilt);
  const typeBio = bool(pick(idx, ['typewriter', 'description_typewriter', 'animated_description', 'typewriter_description'], { accept: (v) => bool(v) !== null }));
  if (typeBio) set('profile.bioMode', 'typewriter', 'Typewriter bio');

  // Page
  const title = sPick(['page_title', 'pagetitle', 'tab_title'], { maxDepth: 4 });
  set('page.title', title, 'Tab title');
  const animTitle = bool(pick(idx, ['animated_title', 'title_animation', 'animatedtitle'], { accept: (v) => bool(v) !== null }));
  if (animTitle) set('page.titleAnimation', 'typewriter');
  const enter = sPick(['page_enter_text', 'pageentertext', 'enter_text', 'entertext', 'click_to_enter', 'splash_text']);
  if (enter) { set('splash.enabled', true); set('splash.text', enter, 'Enter text'); }
  const favicon = urlOf(pick(idx, ['page_favicon', 'favicon'], { accept: (v) => Boolean(urlOf(v)) }));
  set('page.favicon', favicon, 'Favicon');

  // Views — carry the count over so you don't start from zero.
  const views = pick(idx, ['views', 'page_views', 'pageviews', 'view_count', 'profile_views', 'total_views'], { accept: (v) => Number.isFinite(Number(v)) && Number(v) >= 0 && typeof v !== 'boolean' });
  if (views != null) set('views.offset', Math.round(Number(views)), 'View count');

  // Discord
  const discordId = pick(idx, ['discord_id', 'discordid', 'discord_user_id', 'discorduserid'], { accept: (v) => /^\d{15,22}$/.test(String(v)) })
    ?? (() => { const d = pick(idx, ['discord'], { accept: isObj }); const id = d && (d.id || d.user_id || d.discord_id); return /^\d{15,22}$/.test(String(id || '')) ? String(id) : undefined; })();
  set('discord.userId', discordId != null ? String(discordId) : undefined, 'Discord user ID');
  const presence = bool(pick(idx, ['discord_presence', 'discordpresence', 'show_presence', 'presence'], { accept: (v) => bool(v) !== null }));
  if (presence !== null) set('discord.presence', presence, 'Discord presence');

  // Socials
  let socials = parseSocials(pick(idx, ['socials', 'social_links', 'sociallinks', 'social', 'links'], { accept: (v) => parseSocials(v).length > 0 }));
  if (!socials.length) {
    socials = links.map((l) => ({ platform: platformFromUrl(l.href) || 'link', value: l.href, label: l.label && l.label.length < 40 ? l.label : '', icon: '', color: '' }))
      .filter((l, i, arr) => arr.findIndex((x) => x.value === l.value) === i);
  }
  set('links.items', socials, 'Social links');

  // Custom buttons
  const buttons = pick(idx, ['custom_buttons', 'custombuttons', 'buttons'], { accept: (v) => Array.isArray(v) && v.some((b) => isObj(b) && (b.url || b.link)) });
  if (buttons) {
    set('links.buttons', buttons.filter(isObj).map((b) => ({ label: str(b.label ?? b.title ?? b.name ?? b.text) || '', url: str(b.url ?? b.link) || '', platform: platformFromUrl(str(b.url ?? b.link) || '') || 'link', highlight: false })), 'Link buttons');
  }

  // Badges
  set('badges.items', parseBadges(pick(idx, ['badges', 'user_badges'], { accept: (v) => parseBadges(v).length > 0 })), 'Badges');

  // Embed
  set('page.embedTitle', page.ogTitle || undefined);
  set('page.embedDescription', page.ogDescription || undefined);

  return { patch, found, candidates: candidates.length };
}

// Remote media fields that the importer can copy into the local library.
export const MEDIA_KEYS = ['profile.avatar', 'profile.banner', 'bg.image', 'bg.video', 'cursor.image', 'page.favicon'];

// ---------- media downloader ----------
// Addresses a fetch must never reach: private, loopback, link-local (cloud metadata lives at
// 169.254.169.254), carrier-grade NAT, multicast and reserved ranges, plus IPv6 ranges that can
// wrap an IPv4 address (NAT64 64:ff9b::/96, 6to4 2002::/16). BlockList applies the IPv4 rules to
// IPv4-mapped forms like ::ffff:127.0.0.1 by itself.
const BLOCKED = new net.BlockList();
for (const [a, p] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 3]]) BLOCKED.addSubnet(a, p, 'ipv4');
for (const [a, p] of [['::', 96], ['64:ff9b::', 96], ['100::', 64], ['2001:db8::', 32], ['2002::', 16], ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8]]) BLOCKED.addSubnet(a, p, 'ipv6');
const blockedIp = (ip) => BLOCKED.check(ip, net.isIPv6(ip) ? 'ipv6' : 'ipv4');

// The name is resolved once, every address is checked, and the connection goes to exactly the
// checked address, so DNS can't swap in a private one between the check and the connection.
function guardedLookup(hostname, options, cb) {
  dns.lookup(hostname, { all: true }).then((addrs) => {
    if (!addrs.length || addrs.some((a) => blockedIp(a.address))) return cb(new Error('That host is not reachable from here'));
    if (options.all) cb(null, addrs);
    else cb(null, addrs[0].address, addrs[0].family);
  }, () => cb(new Error('That host is not reachable from here')));
}

function get(u) {
  const host = u.hostname.replace(/^\[|\]$/g, '');
  // IP literals skip DNS (and so the lookup above), so they're checked here.
  if (net.isIP(host) && blockedIp(host)) return Promise.reject(new Error('That host is not reachable from here'));
  return new Promise((resolve, reject) => {
    const req = (u.protocol === 'https:' ? https : http).get(u, { headers: { 'user-agent': 'trap.larp media importer' }, lookup: guardedLookup, timeout: 60_000 }, resolve);
    req.on('timeout', () => req.destroy(new Error('Timed out')));
    req.on('error', reject);
  });
}

// Fetch a public URL, re-checking every redirect hop so it can't be bounced to a private address.
async function publicFetch(url) {
  let current = url;
  for (let hop = 0; hop < 6; hop++) {
    let u;
    try { u = new URL(current); } catch { throw new Error('Invalid URL'); }
    if (!/^https?:$/.test(u.protocol)) throw new Error('Only http(s) URLs can be downloaded');
    const res = await get(u);
    if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
      res.resume();
      current = new URL(res.headers.location, u).href;
      continue;
    }
    return {
      u,
      res: { ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, headers: { get: (name) => res.headers[name.toLowerCase()] ?? null }, body: res },
    };
  }
  throw new Error('Too many redirects');
}

// Copy a public file into this site's own storage, so the page keeps working if the original goes away.
export async function downloadToLibrary(url, { maxMb = MAX_UPLOAD_MB, label } = {}) {
  const { res, u } = await publicFetch(url);
  // Anything refused before the body is read still has to let go of the connection.
  const refuse = (message) => { res.body.destroy(); throw new Error(message); };
  if (!res.ok) refuse(`HTTP ${res.status}`);
  const type = String(res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  // The content type wins over the URL's extension; links often end in .php or nothing at all.
  const name = newName(EXT_BY_TYPE[type] ? `file${EXT_BY_TYPE[type]}` : u.pathname);
  if (!name) refuse(`Unsupported file type (${type || path.extname(u.pathname) || 'unknown'})`);
  const limit = maxMb * 1024 * 1024;
  if (Number(res.headers.get('content-length')) > limit) refuse(`File is too large (max ${maxMb} MB)`);

  let size = 0;
  let part = 0;
  let pending = [];
  let pendingSize = 0;
  const flush = async () => {
    await store.writePart(name, part++, Buffer.concat(pending, pendingSize));
    pending = [];
    pendingSize = 0;
  };
  try {
    for await (const chunk of res.body) {
      size += chunk.length;
      if (size > limit) throw new Error(`File is too large (max ${maxMb} MB)`);
      let buf = Buffer.from(chunk);
      while (pendingSize + buf.length >= PART_SIZE) {
        const take = PART_SIZE - pendingSize;
        pending.push(buf.subarray(0, take));
        pendingSize += take;
        buf = buf.subarray(take);
        await flush();
      }
      if (buf.length) {
        pending.push(buf);
        pendingSize += buf.length;
      }
    }
    if (pendingSize || !size) await flush();
    let fallback = u.pathname.split('/').pop() || u.hostname;
    try { fallback = decodeURIComponent(fallback); } catch { /* keep it encoded */ }
    return (await store.finishFile(name, { label: String(label || fallback).slice(0, 120), size })).url;
  } catch (err) {
    await store.abortFile(name).catch(() => {});
    throw err;
  }
}

// Download every remote media URL in a settings patch and swap in the local copies.
export async function localizeMedia(patch) {
  const jobs = [];
  const results = [];
  const swap = async (get, put, label) => {
    const url = get();
    if (!url || !/^https?:\/\//i.test(url)) return;
    try {
      put(await downloadToLibrary(url));
      results.push({ label, ok: true });
    } catch (err) {
      results.push({ label, ok: false, error: err.message });
    }
  };
  for (const key of MEDIA_KEYS) jobs.push(swap(() => getPath(patch, key), (v) => setPath(patch, key, v), key));
  for (const [i, t] of (getPath(patch, 'audio.tracks') || []).entries()) {
    jobs.push(swap(() => t.url, (v) => { t.url = v; }, `track ${i + 1}`));
    jobs.push(swap(() => t.cover, (v) => { t.cover = v; }, `track ${i + 1} cover`));
  }
  for (const [i, b] of (getPath(patch, 'badges.items') || []).entries()) jobs.push(swap(() => b.image, (v) => { b.image = v; }, `badge ${i + 1}`));
  for (const [i, l] of (getPath(patch, 'links.items') || []).entries()) jobs.push(swap(() => l.icon, (v) => { l.icon = v; }, `link icon ${i + 1}`));
  await Promise.all(jobs);
  return results;
}
