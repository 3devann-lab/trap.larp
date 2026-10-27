/* trap.larp ← guns.lol transfer.
 * Runs in YOUR browser, on guns.lol, while you're signed in. It reads your own profile page,
 * collects everything it can find (settings embedded in the page plus what's rendered),
 * and hands it to your trap.larp dashboard. Nothing is sent anywhere else. */
(async () => {
  const ORIGIN = '__ORIGIN__';
  const DASH = '__DASH__';
  if (window.__trapTransfer) return;
  window.__trapTransfer = true;

  const ui = document.createElement('div');
  ui.style.cssText = 'position:fixed;z-index:2147483647;right:16px;bottom:16px;width:340px;max-width:calc(100vw - 32px);background:#0c0c12;color:#f5f5f7;border:1px solid #a855f7;border-radius:14px;padding:16px;font:14px/1.45 system-ui,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.6)';
  ui.innerHTML = '<b style="font-size:15px">trap.larp transfer</b><div data-s style="margin:8px 0;color:#c4c4cc">Starting…</div><div data-b style="display:flex;gap:8px;flex-wrap:wrap"></div>';
  document.body.appendChild(ui);
  const status = (m) => { ui.querySelector('[data-s]').textContent = m; };
  const btn = (label, fn) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = 'background:#a855f7;color:#fff;border:0;border-radius:8px;padding:7px 12px;font:inherit;cursor:pointer';
    b.onclick = fn;
    ui.querySelector('[data-b]').appendChild(b);
    return b;
  };
  const close = () => { ui.remove(); window.__trapTransfer = false; };

  // Open the dashboard right away, while the click still counts as a user gesture.
  const target = window.open(ORIGIN + DASH + '#import-guns', '_blank');

  const RESERVED = ['', 'dashboard', 'login', 'register', 'signup', 'account', 'settings', 'pricing', 'premium', 'shop', 'leaderboard', 'help', 'terms', 'privacy', 'api', 'discord', 'faq', 'about', 'contact', 'explore', 'customize', 'search'];
  let user = location.pathname.split('/').filter(Boolean)[0] || '';
  if (RESERVED.includes(user.toLowerCase())) user = '';
  if (!user) user = (prompt('Your guns.lol username (the part after guns.lol/)') || '').trim().replace(/^@/, '').replace(/^https?:\/\/guns\.lol\//i, '');
  if (!user) { status('No username given.'); btn('Close', close); return; }

  const onProfile = location.pathname.replace(/\/+$/, '').toLowerCase() === '/' + user.toLowerCase();
  status('Reading guns.lol/' + user + ' …');

  let html = '';
  if (!onProfile) {
    try {
      const r = await fetch('/' + encodeURIComponent(user), { credentials: 'include' });
      html = await r.text();
    } catch (e) { status('Could not load your profile page: ' + e.message); }
  }
  const docs = [];
  if (onProfile) docs.push({ doc: document, live: true, raw: '' });
  if (html) docs.push({ doc: new DOMParser().parseFromString(html, 'text/html'), live: false, raw: html });
  if (!onProfile) docs.push({ doc: document, live: true, raw: '' }); // the page you're on (e.g. the guns.lol dashboard) may hold settings too

  // ---------- 1. Embedded data (Next.js payloads, JSON scripts) ----------
  const KEYS = ['username', 'displayname', 'description', 'bio', 'avatar', 'avatarurl', 'background', 'backgroundurl', 'audio', 'audiourl', 'audios',
    'cursor', 'cursorurl', 'accentcolor', 'textcolor', 'backgroundcolor', 'iconcolor', 'socials', 'badges', 'location', 'views', 'pageviews',
    'uid', 'discord', 'discordid', 'profileopacity', 'profileblur', 'usernameeffects', 'backgroundeffects', 'monochromeicons', 'pagetitle',
    'entertext', 'pageentertext', 'glowusername', 'glowsocials', 'glowbadges', 'banner', 'font', 'layout', 'premium', 'alias', 'customization', 'config'];
  const norm = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
  const parsed = [];
  const tryParse = (s) => { try { return JSON.parse(s); } catch { return undefined; } };

  for (const { doc, live, raw } of docs) {
    const nd = doc.getElementById('__NEXT_DATA__');
    if (nd) { const v = tryParse(nd.textContent); if (v) parsed.push(v); }
    let flight = '';
    if (live && Array.isArray(window.__next_f)) {
      flight = window.__next_f.map((x) => (typeof x?.[1] === 'string' ? x[1] : '')).join('');
    } else {
      const src = raw || [...doc.querySelectorAll('script:not([src])')].map((s) => s.textContent).join('\n');
      for (const m of src.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)) {
        const v = tryParse('"' + m[1] + '"');
        if (typeof v === 'string') flight += v;
      }
    }
    for (const line of flight.split('\n')) {
      const body = line.replace(/^[0-9a-z]+:/i, '');
      if (body[0] === '{' || body[0] === '[') { const v = tryParse(body); if (v) parsed.push(v); }
    }
    for (const s of doc.querySelectorAll('script[type="application/json"],script[type="application/ld+json"]')) {
      const v = tryParse(s.textContent); if (v) parsed.push(v);
    }
  }

  const candidates = [];
  const seen = new WeakSet();
  const walk = (node, depth) => {
    if (!node || typeof node !== 'object' || seen.has(node) || depth > 40) return;
    seen.add(node);
    if (!Array.isArray(node)) {
      const keys = Object.keys(node).map(norm);
      const score = keys.filter((k) => KEYS.includes(k)).length;
      if (score >= 3 || (score >= 1 && keys.some((k) => ['socials', 'badges', 'audios', 'audio'].includes(k)))) candidates.push({ score, node });
    }
    for (const v of Object.values(node)) walk(v, depth + 1);
  };
  for (const p of parsed) walk(p, 0);
  candidates.sort((a, b) => b.score - a.score);

  // Trim huge/irrelevant branches (React element trees etc.) before sending.
  const trim = (v, depth) => {
    if (v == null || typeof v === 'boolean' || typeof v === 'number') return v;
    if (typeof v === 'string') return v.length > 4000 ? v.slice(0, 4000) : v;
    if (depth > 6) return undefined;
    if (Array.isArray(v)) {
      if (v[0] === '$') return undefined; // RSC element
      return v.slice(0, 80).map((x) => trim(x, depth + 1));
    }
    const out = {};
    for (const [k, x] of Object.entries(v).slice(0, 150)) { const t = trim(x, depth + 1); if (t !== undefined) out[k] = t; }
    return out;
  };
  const picked = candidates.slice(0, 12).map((c) => trim(c.node, 0));

  // ---------- 2. What's rendered on the page ----------
  const base = { doc: docs[0].doc, live: docs[0].live };
  const d = base.doc;
  const abs = (u) => { if (!u) return null; try { return new URL(u, 'https://guns.lol/').href; } catch { return null; } };
  const meta = (sel) => d.querySelector(sel)?.getAttribute('content') || null;
  const uniq = (arr) => [...new Set(arr.filter(Boolean))];
  const urlsInStyle = (s) => [...String(s || '').matchAll(/url\((['"]?)(.*?)\1\)/g)].map((m) => abs(m[2]));

  const media = {
    videos: uniq([...d.querySelectorAll('video[src],video source[src]')].map((e) => abs(e.getAttribute('src')))),
    audios: uniq([...d.querySelectorAll('audio[src],audio source[src]')].map((e) => abs(e.getAttribute('src')))),
    images: [...d.querySelectorAll('img[src]')].slice(0, 60).map((img) => ({
      src: abs(img.getAttribute('src')),
      alt: img.getAttribute('alt') || '',
      hint: ((img.className?.baseVal ?? img.className) + ' ' + (img.id || '') + ' ' + (img.closest('[class]')?.className || '')).toString().slice(0, 200),
      w: img.naturalWidth || Number(img.getAttribute('width')) || 0,
      h: img.naturalHeight || Number(img.getAttribute('height')) || 0,
    })).filter((i) => i.src),
    backgrounds: uniq([...d.querySelectorAll('[style*="url("]')].flatMap((e) => urlsInStyle(e.getAttribute('style')))),
    cursor: null,
  };
  if (base.live) {
    for (const el of [d.documentElement, d.body, d.querySelector('main'), d.querySelector('#__next')]) {
      if (!el) continue;
      const c = urlsInStyle(getComputedStyle(el).cursor)[0];
      if (c) { media.cursor = c; break; }
    }
    // Audio created from JS (not in the DOM) — check performance entries for media requests.
    for (const e of performance.getEntriesByType('resource')) {
      if (/\.(mp3|ogg|wav|m4a|aac|flac|opus)(\?|$)/i.test(e.name)) media.audios.push(e.name);
      if (/\.(mp4|webm|mov)(\?|$)/i.test(e.name)) media.videos.push(e.name);
      if (/\.(cur|ani)(\?|$)/i.test(e.name) && !media.cursor) media.cursor = e.name;
    }
    media.audios = uniq(media.audios);
    media.videos = uniq(media.videos);
  }

  const links = [...d.querySelectorAll('a[href]')].map((a) => ({
    href: abs(a.getAttribute('href')),
    label: (a.getAttribute('aria-label') || a.getAttribute('title') || a.textContent || '').trim().slice(0, 80),
  })).filter((l) => l.href && !/^https?:\/\/(www\.)?guns\.lol(\/|$)/i.test(l.href));

  const payload = {
    kind: 'guns.lol-transfer', v: 1, user, at: Date.now(), source: location.href,
    page: {
      title: d.title || null,
      ogTitle: meta('meta[property="og:title"]'),
      ogDescription: meta('meta[property="og:description"]') || meta('meta[name="description"]'),
      ogImage: abs(meta('meta[property="og:image"]') || ''),
      themeColor: meta('meta[name="theme-color"]'),
      favicon: abs(d.querySelector('link[rel~="icon"]')?.getAttribute('href') || ''),
      h1: d.querySelector('h1')?.textContent?.trim().slice(0, 80) || null,
    },
    candidates: picked,
    media,
    links,
  };

  const json = JSON.stringify(payload);
  const found = picked.length ? picked.length + ' settings blocks' : 'page content only';
  status('Collected ' + found + ', ' + media.audios.length + ' audio, ' + links.length + ' links. Sending to trap.larp…');

  // ---------- 3. Hand off to the dashboard ----------
  let delivered = false;
  window.addEventListener('message', (e) => {
    if (e.origin !== ORIGIN || !e.data || typeof e.data !== 'object') return;
    if (e.data.type === 'traplarp:ready' && !delivered) e.source.postMessage({ type: 'traplarp:guns-data', payload }, ORIGIN);
    if (e.data.type === 'traplarp:received') {
      delivered = true;
      status('Sent ✓ Review and apply it in your trap.larp dashboard.');
    }
  });
  const fallback = () => {
    if (delivered) return;
    status('Couldn\'t reach the dashboard tab automatically. Copy the data and paste it in trap.larp → Import / backup → "Paste transfer data".');
    btn('Copy data', async () => {
      try { await navigator.clipboard.writeText(json); status('Copied ✓ Now paste it in your dashboard.'); }
      catch { prompt('Copy this:', json); }
    });
    btn('Download .json', () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      a.download = 'guns-transfer-' + user + '.json';
      a.click();
    });
  };
  if (!target) fallback(); else setTimeout(fallback, 8000);
  btn('Close', close);
})();
