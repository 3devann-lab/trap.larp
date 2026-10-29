import { fontHref } from '../shared/fonts.js';
import { resolveLink, PLATFORMS } from '../shared/platforms.js';
import { BADGE_PRESETS } from '../shared/badges.js';
import { iconSet, UI_ICONS } from './icons.js';
import { DASHBOARD_PATH } from './env.js';
import { findEffect } from './discord.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// JSON that is safe to drop inside a <script> tag.
export const safeJson = (v) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

const stripMd = (s) => String(s || '').replace(/<a?:(\w+):\d+>/g, ':$1:').replace(/[*_~`]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

function absolute(origin, url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return origin + (url.startsWith('/') ? url : '/' + url);
}

function avatarUrl(cfg, discord) {
  if (cfg.profile.avatarSource === 'discord' && discord?.avatar && discord.id) {
    const ext = discord.avatar.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${discord.id}/${discord.avatar}.${ext}?size=256`;
  }
  return cfg.profile.avatar || '';
}

// Icons the page needs up front (the client fetches the rest on demand).
function neededIcons(cfg) {
  const refs = new Set(UI_ICONS.map((n) => `lu:${n}`));
  const byId = new Map(PLATFORMS.map((p) => [p.id, p]));
  for (const l of cfg.links.items || []) refs.add(byId.get(l.platform)?.icon || 'lu:link');
  for (const b of cfg.links.buttons || []) refs.add(byId.get(b.platform)?.icon || 'lu:link');
  const badgeById = new Map(BADGE_PRESETS.map((b) => [b.id, b]));
  for (const b of cfg.badges.items || []) if (badgeById.has(b.preset)) refs.add(badgeById.get(b.preset).icon);
  refs.add('si:discord').add('si:spotify').add('si:github').add('si:youtube');
  return iconSet(refs);
}

export function renderProfile(cfg, { origin, views, discord, preview, authed }) {
  const name = (cfg.discord.useName && discord?.globalName) || cfg.profile.displayName || cfg.profile.username || 'trap.larp';
  const title = cfg.page.title || name;
  const avatar = avatarUrl(cfg, discord);
  const bio = (cfg.discord.useBio && discord?.bio) || cfg.profile.bio || '';
  const embedTitle = cfg.page.embedTitle || title;
  const embedDesc = cfg.page.embedDescription || stripMd(bio).slice(0, 300);
  const embedImage = absolute(origin, cfg.page.embedImage || avatar);
  const favicon = cfg.page.favicon || avatar || '/static/favicon.svg';
  const fonts = [...new Set([cfg.look.font, cfg.name.font, cfg.splash.font].filter(Boolean))].map(fontHref).filter(Boolean);
  const pageUrl = origin + '/';

  // Blocked comment words stay on the server; visitors shouldn't see (or learn to dodge) them.
  const { blocked, ...comments } = cfg.comments;
  const boot = {
    config: { ...cfg, comments },
    views,
    discord: discord || null,
    preview: Boolean(preview),
    authed: Boolean(authed),
    // Only the signed-in owner gets the dashboard link; visitors mustn't learn a secret DASHBOARD_PATH.
    dashboard: authed ? DASHBOARD_PATH : null,
    icons: neededIcons(cfg),
    effect: cfg.discord.effect === 'pick' ? findEffect(cfg.discord.effectId) : null,
  };

  // A minimal no-JS fallback so link previews and crawlers still see your links.
  const noscriptLinks = (cfg.links.items || []).map((l) => {
    const r = resolveLink(l);
    return r?.href ? `<a href="${esc(r.href)}" rel="me noopener">${esc(l.label || l.platform)}</a>` : '';
  }).join(' ');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(embedDesc)}">
<meta name="theme-color" content="${esc(cfg.page.embedColor || cfg.look.accent)}">
${cfg.page.noIndex || preview ? '<meta name="robots" content="noindex, nofollow">' : ''}
<link rel="icon" href="${esc(favicon)}">
<link rel="apple-touch-icon" href="${esc(favicon)}">
<link rel="canonical" href="${esc(pageUrl)}">
<meta property="og:type" content="profile">
<meta property="og:site_name" content="${esc(cfg.page.siteName || 'trap.larp')}">
<meta property="og:title" content="${esc(embedTitle)}">
<meta property="og:description" content="${esc(embedDesc)}">
<meta property="og:url" content="${esc(pageUrl)}">
${embedImage ? `<meta property="og:image" content="${esc(embedImage)}">` : ''}
<meta name="twitter:card" content="${cfg.page.embedLarge ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${esc(embedTitle)}">
<meta name="twitter:description" content="${esc(embedDesc)}">
${embedImage ? `<meta name="twitter:image" content="${esc(embedImage)}">` : ''}
<link rel="alternate" type="application/json+oembed" href="${esc(origin)}/oembed.json">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${fonts.map((h) => `<link rel="stylesheet" href="${esc(h)}">`).join('\n')}
<link rel="stylesheet" href="/static/profile/profile.css">
${avatar ? `<link rel="preload" as="image" href="${esc(avatar)}">` : ''}
<style id="custom-css">${String(cfg.custom.css || '').replace(/<\/style/gi, '<\\/style')}</style>
${cfg.custom.head || ''}
</head>
<body class="booting">
<div id="app" aria-live="polite"></div>
<noscript><main style="font-family:system-ui;color:#fff;background:#000;min-height:100vh;display:grid;place-items:center;text-align:center"><div><h1>${esc(name)}</h1><p>${esc(stripMd(bio))}</p><p>${noscriptLinks}</p></div></main></noscript>
<script>window.__TRAP__ = ${safeJson(boot)};</script>
<script type="module" src="/static/profile/profile.js"></script>
${cfg.custom.body || ''}
${cfg.custom.js ? `<script>${String(cfg.custom.js).replace(/<\/script/gi, '<\\/script')}</script>` : ''}
</body>
</html>`;
}

export function renderLogin({ error, configured }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>trap.larp · sign in</title>
<link rel="icon" href="/static/favicon.svg">
<link rel="stylesheet" href="/static/dashboard/login.css">
</head>
<body>
<main class="login">
  <div class="logo">trap<span>.larp</span></div>
  <p class="sub">dashboard</p>
  ${configured ? `<form id="f">
    <input type="password" name="password" placeholder="password" autocomplete="current-password" autofocus required>
    <button type="submit">enter</button>
    <p class="err" id="err">${esc(error || '')}</p>
  </form>` : `<p class="err">Set the <code>DASHBOARD_PASSWORD</code> environment variable on your server (Railway → Variables), then redeploy.</p>`}
</main>
<script>
const f = document.getElementById('f');
if (f) f.addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = document.getElementById('err');
  err.textContent = '';
  const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: f.password.value }) });
  if (r.ok) return location.reload();
  const d = await r.json().catch(() => ({}));
  err.textContent = d.error || 'Something went wrong.';
  f.password.select();
});
</script>
</body>
</html>`;
}

export function renderDashboard({ ephemeral, weakPassword }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>trap.larp · dashboard</title>
<link rel="icon" href="/static/favicon.svg">
<link rel="stylesheet" href="/static/dashboard/dashboard.css">
</head>
<body>
<div id="dash"></div>
<script>window.__DASH__ = ${safeJson({ path: DASHBOARD_PATH, ephemeral, weakPassword })};</script>
<script type="module" src="/static/dashboard/dashboard.js"></script>
</body>
</html>`;
}
