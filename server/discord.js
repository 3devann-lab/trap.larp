// Discord data helpers. Live presence comes from Lanyard straight in the browser;
// the server proxies and caches profile details, invites and app icons.
import { profileEffects } from '@discord-user-card/profile-effects';

const UA = 'trap.larp (self-hosted bio page)';
const cache = new Map();

async function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.value;
  if (hit?.pending) return hit.pending;
  const pending = fn()
    .then((value) => {
      cache.set(key, { value, exp: Date.now() + ttlMs });
      return value;
    })
    .catch((err) => {
      // Serve stale data if we have it; otherwise remember the failure briefly.
      if (hit?.value !== undefined) {
        cache.set(key, { value: hit.value, exp: Date.now() + 60_000 });
        return hit.value;
      }
      cache.set(key, { value: null, exp: Date.now() + 30_000, error: err.message });
      return null;
    });
  cache.set(key, { ...(hit || {}), pending });
  return pending;
}

async function getJson(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

export const isSnowflake = (id) => /^\d{15,22}$/.test(String(id || ''));

// ---------- Profile effects catalog ----------
const EFFECTS = profileEffects.map((e) => ({
  id: e.id,
  sku: e.sku_id,
  title: e.title,
  description: e.description,
  thumb: e.thumbnailPreviewSrc,
  still: e.reducedMotionSrc,
  layers: (e.effects || []).map((l) => ({
    src: l.src, loop: Boolean(l.loop), start: l.start || 0, duration: l.duration || 0, loopDelay: l.loopDelay || 0, z: l.zIndex || 0,
  })),
}));
const EFFECT_INDEX = new Map();
for (const e of EFFECTS) {
  EFFECT_INDEX.set(e.id, e);
  EFFECT_INDEX.set(e.sku, e);
}

export const effectCatalog = () => EFFECTS;
export const findEffect = (id) => (id ? EFFECT_INDEX.get(String(id)) || null : null);

// ---------- Profile (bio, banner, badges, effect, connections) ----------
export function getProfile(userId) {
  if (!isSnowflake(userId)) return Promise.resolve(null);
  return cached(`profile:${userId}`, 5 * 60_000, async () => {
    const d = await getJson(`https://dcdn.dstn.to/profile/${userId}`);
    const u = d.user || {};
    const p = d.user_profile || {};
    const guild = u.primary_guild || u.clan || null;
    const effectId = p.profile_effect?.id || null;
    return {
      id: u.id,
      username: u.username,
      globalName: u.global_name || null,
      avatar: u.avatar || null,
      banner: p.banner || u.banner || null,
      bannerColor: u.banner_color || null,
      accentColor: p.accent_color ?? u.accent_color ?? null,
      bio: p.bio || u.bio || '',
      pronouns: p.pronouns || '',
      themeColors: Array.isArray(p.theme_colors) ? p.theme_colors : null,
      decoration: u.avatar_decoration_data?.asset || null,
      nameplate: u.collectibles?.nameplate?.asset || null,
      clan: guild?.tag ? { tag: guild.tag, badge: guild.badge, guildId: guild.identity_guild_id } : null,
      badges: (d.badges || []).map((b) => ({ id: b.id, description: b.description, icon: b.icon, link: b.link || null })),
      connections: (d.connected_accounts || []).map((c) => ({ type: c.type, id: c.id, name: c.name, verified: Boolean(c.verified) })),
      effect: effectId ? findEffect(effectId) || { id: effectId, unknown: true } : null,
      premiumSince: d.premium_since || null,
    };
  });
}

// ---------- Server invites ----------
export const inviteCode = (value) => String(value || '').trim().replace(/^https?:\/\/(www\.)?(discord\.gg|discord(app)?\.com\/invite)\//i, '').replace(/[/?#].*$/, '');

export function getInvite(code) {
  const clean = inviteCode(code);
  if (!/^[\w-]{2,40}$/.test(clean)) return Promise.resolve(null);
  return cached(`invite:${clean}`, 10 * 60_000, async () => {
    const d = await getJson(`https://discord.com/api/v10/invites/${encodeURIComponent(clean)}?with_counts=true`);
    const g = d.guild || {};
    return {
      code: clean,
      id: g.id,
      name: g.name,
      icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.${g.icon.startsWith('a_') ? 'gif' : 'png'}?size=128` : null,
      banner: g.banner ? `https://cdn.discordapp.com/banners/${g.id}/${g.banner}.png?size=600` : g.splash ? `https://cdn.discordapp.com/splashes/${g.id}/${g.splash}.png?size=600` : null,
      description: g.description || null,
      members: d.approximate_member_count ?? null,
      online: d.approximate_presence_count ?? null,
      verified: (g.features || []).includes('VERIFIED'),
      partnered: (g.features || []).includes('PARTNERED'),
    };
  });
}

// ---------- Application icons for "Playing …" activities ----------
export function getAppIcon(appId) {
  if (!isSnowflake(appId)) return Promise.resolve(null);
  return cached(`app:${appId}`, 24 * 3600_000, async () => {
    const d = await getJson(`https://discord.com/api/v10/applications/${appId}/rpc`);
    return d.icon ? `https://cdn.discordapp.com/app-icons/${appId}/${d.icon}.png?size=128` : null;
  });
}

// ---------- Lanyard status check (for the dashboard) ----------
export async function checkLanyard(userId) {
  if (!isSnowflake(userId)) return { ok: false, error: 'Not a valid user ID.' };
  try {
    const res = await fetch(`https://api.lanyard.rest/v1/users/${userId}`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(8000) });
    const d = await res.json().catch(() => ({}));
    if (d.success) return { ok: true, status: d.data?.discord_status, username: d.data?.discord_user?.username };
    return { ok: false, error: d.error?.message || `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
