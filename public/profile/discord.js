// Live Discord presence via Lanyard (websocket with REST fallback) + rendering helpers.
import { h, icon, fmtDuration } from './util.js';

export const STATUS_COLORS = { online: '#23a55a', idle: '#f0b232', dnd: '#f23f43', offline: '#80848e', streaming: '#593695' };
const STATUS_TEXT = { online: 'Online', idle: 'Idle', dnd: 'Do Not Disturb', offline: 'Offline' };

export class LanyardLive {
  constructor() {
    this.id = null;
    this.data = null;
    this.listeners = new Set();
    this.ws = null;
    this.retry = 0;
  }

  on(fn) { this.listeners.add(fn); if (this.data) fn(this.data); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) fn(this.data); }

  watch(id) {
    if (!/^\d{15,22}$/.test(String(id || ''))) { this.stop(); this.id = null; this.data = null; this.emit(); return; }
    if (id === this.id) return;
    this.stop();
    this.id = id;
    this.data = null;
    this.fetchOnce();
    this.connect();
  }

  async fetchOnce() {
    const id = this.id;
    try {
      const res = await fetch(`https://api.lanyard.rest/v1/users/${id}`);
      const json = await res.json();
      if (json.success && id === this.id && !this.data) { this.data = json.data; this.emit(); }
      if (!json.success && id === this.id) { this.missing = true; this.emit(); }
    } catch { /* websocket will try too */ }
  }

  connect() {
    const id = this.id;
    let ws;
    try { ws = new WebSocket('wss://api.lanyard.rest/socket'); } catch { return; }
    this.ws = ws;
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.op === 1) {
        ws.send(JSON.stringify({ op: 2, d: { subscribe_to_id: id } }));
        clearInterval(this.hb);
        this.hb = setInterval(() => ws.readyState === 1 && ws.send(JSON.stringify({ op: 3 })), msg.d.heartbeat_interval);
      } else if (msg.op === 0 && (msg.t === 'INIT_STATE' || msg.t === 'PRESENCE_UPDATE')) {
        this.retry = 0;
        this.missing = false;
        this.data = msg.d;
        this.emit();
      }
    };
    ws.onclose = () => {
      clearInterval(this.hb);
      if (this.ws !== ws || this.id !== id) return;
      const wait = Math.min(30000, 1000 * 2 ** this.retry++);
      this.reconnect = setTimeout(() => this.connect(), wait);
    };
  }

  stop() {
    clearInterval(this.hb);
    clearTimeout(this.reconnect);
    const ws = this.ws;
    this.ws = null;
    if (ws) try { ws.close(); } catch { /* already closed */ }
  }
}

// ---------- URL helpers ----------
export function avatarUrl(user, size = 256) {
  if (!user?.id) return null;
  if (!user.avatar) {
    const idx = Number((BigInt(user.id) >> 22n) % 6n);
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
  }
  const ext = user.avatar.startsWith('a_') ? 'gif' : 'webp';
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=${size}`;
}

export const bannerUrl = (id, hash) => (hash ? `https://cdn.discordapp.com/banners/${id}/${hash}.${hash.startsWith('a_') ? 'gif' : 'webp'}?size=600` : null);
export const decorationUrl = (asset) => (asset ? `https://cdn.discordapp.com/avatar-decoration-presets/${asset}.png?size=240&passthrough=true` : null);
export const badgeIconUrl = (icon) => `https://cdn.discordapp.com/badge-icons/${icon}.png`;
export const clanBadgeUrl = (guildId, badge) => (guildId && badge ? `https://cdn.discordapp.com/clan-badges/${guildId}/${badge}.png?size=32` : null);
export const nameplateUrl = (asset) => (asset ? `https://cdn.discordapp.com/assets/collectibles/${asset.replace(/\/?$/, '/')}asset.webm` : null);

function assetUrl(appId, asset) {
  if (!asset) return null;
  if (asset.startsWith('mp:')) return `https://media.discordapp.net/${asset.slice(3)}`;
  if (asset.startsWith('spotify:')) return `https://i.scdn.co/image/${asset.slice(8)}`;
  if (asset.startsWith('youtube:')) return `https://i.ytimg.com/vi/${asset.slice(8)}/hqdefault.jpg`;
  if (asset.startsWith('twitch:')) return `https://static-cdn.jtvnw.net/previews-ttv/live_user_${asset.slice(7)}-320x180.jpg`;
  if (/^https?:/.test(asset)) return asset;
  return appId ? `https://cdn.discordapp.com/app-assets/${appId}/${asset}.png` : null;
}

const emojiNode = (emoji) => {
  if (!emoji) return null;
  if (emoji.id) return h('img', { class: 'emoji', alt: emoji.name || '', src: `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'webp'}?size=48` });
  return h('span', { class: 'emoji-text' }, emoji.name);
};

const VERB = { 0: 'Playing', 1: 'Streaming', 2: 'Listening to', 3: 'Watching', 5: 'Competing in' };

function imgWithFallback(src, fallbackIcon, cls) {
  const wrap = h('div', { class: cls });
  if (src) {
    const img = h('img', { src, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
    img.onerror = () => { img.remove(); wrap.append(icon(fallbackIcon)); wrap.classList.add('fallback'); };
    wrap.append(img);
  } else {
    wrap.append(icon(fallbackIcon));
    wrap.classList.add('fallback');
  }
  return wrap;
}

// Renders the presence widget; returns { el, update(data), destroy() }.
export function presenceWidget(cfg, live, profile) {
  const d = cfg.discord;
  const root = h('div', { class: `presence presence-${d.presenceStyle}` });
  let tick = null;

  const render = (data) => {
    clearInterval(tick);
    root.replaceChildren();
    if (!data) {
      root.append(h('div', { class: 'presence-row muted' }, icon('si:discord'), h('span', {}, live.missing ? 'join discord.gg/lanyard to show live status' : 'connecting to discord…')));
      return;
    }
    const user = data.discord_user || {};
    const status = data.discord_status || 'offline';
    const activities = (data.activities || []).filter((a) => a.type !== 4 && a.id !== 'spotify:1');
    const custom = (data.activities || []).find((a) => a.type === 4);
    const spotify = d.showSpotify && data.listening_to_spotify ? data.spotify : null;
    const platforms = [data.active_on_discord_desktop && 'monitor', data.active_on_discord_mobile && 'smartphone', data.active_on_discord_web && 'globe'].filter(Boolean);

    if (d.showNameplate && profile?.nameplate && d.presenceStyle !== 'minimal') {
      const v = h('video', { class: 'nameplate', src: nameplateUrl(profile.nameplate), autoplay: true, muted: true, loop: true, playsinline: true });
      v.muted = true;
      v.onerror = () => v.remove();
      root.append(v);
    }

    const statusDot = h('span', { class: 'sdot', style: { background: STATUS_COLORS[status] } });
    const name = user.global_name || user.display_name || user.username || 'discord';

    if (d.presenceStyle === 'minimal') {
      const line = custom?.state || (spotify ? `listening to ${spotify.song}` : activities[0] ? `${(VERB[activities[0].type] || 'Playing').toLowerCase()} ${activities[0].name}` : status === 'offline' ? d.offlineText : STATUS_TEXT[status].toLowerCase());
      root.append(h('div', { class: 'presence-row' }, statusDot, d.showCustomStatus && custom?.emoji ? emojiNode(custom.emoji) : null, h('span', { class: 'ell' }, line)));
      return;
    }

    // Header: avatar + name + status
    const head = h('div', { class: 'presence-head' },
      h('div', { class: 'p-avatar' },
        h('img', { src: avatarUrl(user, 128), alt: '', loading: 'lazy' }),
        user.avatar_decoration_data?.asset ? h('img', { class: 'p-deco', src: decorationUrl(user.avatar_decoration_data.asset), alt: '' }) : null,
        h('span', { class: 'p-status', style: { background: STATUS_COLORS[status] } })),
      h('div', { class: 'p-id' },
        h('div', { class: 'p-name' }, h('span', { class: 'ell' }, name), d.showPlatform && platforms.length ? h('span', { class: 'p-plat', title: platforms.join(', ') }, platforms.map((p) => icon('lu:' + p))) : null),
        d.showCustomStatus && custom && (custom.state || custom.emoji)
          ? h('div', { class: 'p-custom ell' }, emojiNode(custom.emoji), custom.state ? h('span', {}, ' ' + custom.state) : null)
          : h('div', { class: 'p-sub ell' }, status === 'offline' ? d.offlineText : STATUS_TEXT[status])));
    root.append(head);

    const timers = [];
    if (d.showActivity) {
      for (const a of activities.slice(0, d.presenceStyle === 'compact' ? 1 : 2)) {
        const large = assetUrl(a.application_id, a.assets?.large_image) || (a.application_id ? `/api/discord/app-icon/${a.application_id}` : null);
        const small = assetUrl(a.application_id, a.assets?.small_image);
        const time = h('div', { class: 'p-line p-time' });
        if (a.timestamps?.start || a.timestamps?.end) timers.push(() => {
          time.textContent = a.timestamps.end ? `${fmtDuration(a.timestamps.end - Date.now())} left` : `${fmtDuration(Date.now() - a.timestamps.start)} elapsed`;
        });
        root.append(h('div', { class: 'activity' },
          h('div', { class: 'act-art' }, imgWithFallback(large, 'lu:gamepad-2', 'act-large'), small ? h('img', { class: 'act-small', src: small, alt: '', title: a.assets?.small_text || '' }) : null),
          h('div', { class: 'act-info' },
            h('div', { class: 'p-line p-verb' }, VERB[a.type] || 'Playing'),
            h('div', { class: 'p-line p-title ell' }, a.name),
            a.details ? h('div', { class: 'p-line ell' }, a.details) : null,
            a.state ? h('div', { class: 'p-line ell muted' }, a.state) : null,
            time)));
      }
    }
    if (spotify) {
      const bar = h('div', { class: 'sp-fill' });
      const cur = h('span', {});
      const tot = h('span', {});
      timers.push(() => {
        const { start, end } = spotify.timestamps || {};
        if (!start || !end) return;
        const k = Math.min(1, Math.max(0, (Date.now() - start) / (end - start)));
        bar.style.width = (k * 100).toFixed(2) + '%';
        cur.textContent = fmtDuration(Date.now() - start);
        tot.textContent = fmtDuration(end - start);
      });
      root.append(h('a', { class: 'activity spotify', href: spotify.track_id ? `https://open.spotify.com/track/${spotify.track_id}` : null, target: '_blank', rel: 'noopener' },
        h('div', { class: 'act-art' }, imgWithFallback(spotify.album_art_url, 'si:spotify', 'act-large'), h('span', { class: 'sp-logo' }, icon('si:spotify'))),
        h('div', { class: 'act-info' },
          h('div', { class: 'p-line p-verb' }, 'Listening to Spotify'),
          h('div', { class: 'p-line p-title ell' }, spotify.song),
          h('div', { class: 'p-line ell' }, 'by ' + String(spotify.artist || '').replace(/;/g, ',')),
          d.presenceStyle !== 'compact' ? h('div', { class: 'sp-bar' }, h('div', { class: 'sp-track' }, bar), h('div', { class: 'sp-times' }, cur, tot)) : null)));
    }
    if (timers.length) {
      const run = () => timers.forEach((fn) => fn());
      run();
      tick = setInterval(run, 1000);
    }
  };

  if (d.linkProfile && d.userId) {
    root.classList.add('clickable');
    root.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      window.open(`https://discord.com/users/${d.userId}`, '_blank', 'noopener');
    });
  }

  const off = live.on(render);
  if (!live.data) render(null);
  return { el: root, destroy() { off(); clearInterval(tick); } };
}

// Maps Discord connected accounts to profile link items.
const CONNECTION_MAP = {
  github: (c) => ({ platform: 'github', value: c.name }),
  twitter: (c) => ({ platform: 'x', value: c.name }),
  spotify: (c) => ({ platform: 'spotify', value: c.id }),
  steam: (c) => ({ platform: 'steam', value: c.id }),
  youtube: (c) => ({ platform: 'youtube', value: `https://youtube.com/channel/${c.id}` }),
  twitch: (c) => ({ platform: 'twitch', value: c.name }),
  reddit: (c) => ({ platform: 'reddit', value: c.name }),
  tiktok: (c) => ({ platform: 'tiktok', value: c.name }),
  instagram: (c) => ({ platform: 'instagram', value: c.name }),
  xbox: (c) => ({ platform: 'xbox', value: c.name }),
  playstation: (c) => ({ platform: 'playstation', value: c.name }),
  battlenet: (c) => ({ platform: 'battlenet', value: c.name }),
  riotgames: (c) => ({ platform: 'riot', value: c.name }),
  leagueoflegends: (c) => ({ platform: 'lol', value: c.name }),
  domain: (c) => ({ platform: 'website', value: `https://${c.name}` }),
  ebay: (c) => ({ platform: 'ebay', value: c.name }),
  bluesky: (c) => ({ platform: 'bluesky', value: c.name }),
  roblox: (c) => ({ platform: 'roblox', value: c.id }),
  bungie: (c) => ({ platform: 'copy', value: c.name, label: 'Bungie: ' + c.name }),
  crunchyroll: (c) => ({ platform: 'crunchyroll', value: c.name, label: 'Crunchyroll' }),
  mastodon: (c) => {
    const m = String(c.name).match(/^@?([^@]+)@(.+)$/);
    return m ? { platform: 'mastodon', value: `https://${m[2]}/@${m[1]}` } : null;
  },
};

export function connectionLinks(profile) {
  return (profile?.connections || []).map((c) => {
    const fn = CONNECTION_MAP[c.type];
    const item = fn ? fn(c) : null;
    return item ? { id: `dc-${c.type}-${c.id}`, label: '', icon: '', color: '', ...item } : null;
  }).filter(Boolean);
}
