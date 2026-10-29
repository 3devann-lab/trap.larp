// Custom dashboard sections: overview analytics, theme gallery, media library, import/backup.
import { h, icon, toast, fmtNum, copyText } from '/static/profile/util.js';
import { THEMES, applyTheme } from '/shared/themes.js';
import { platformById } from '/shared/platforms.js';
import { fontHref } from '/shared/fonts.js';
import { api, confirmBox, uploadFiles } from './fields.js';

const ago = (t) => {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

// ---------- overview ----------
function dailyChart(days) {
  const W = 640; const H = 180; const padL = 34; const padB = 22; const padT = 10;
  const max = Math.max(4, ...days.map((d) => d.views));
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / step) * step;
  const plotW = W - padL; const plotH = H - padB - padT;
  const slot = plotW / days.length;
  const bw = Math.max(4, slot - 2);
  const y = (v) => padT + plotH - (v / top) * plotH;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'chart');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Daily views, last 30 days');
  const add = (tag, attrs) => { const el = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); svg.append(el); return el; };
  for (let i = 0; i <= 4; i++) {
    const v = (top / 4) * i;
    add('line', { x1: padL, x2: W, y1: y(v), y2: y(v), class: 'grid' });
    add('text', { x: padL - 6, y: y(v) + 4, class: 'axis', 'text-anchor': 'end' }).textContent = fmtNum(v, true);
  }
  const tip = h('div', { class: 'chart-tip', hidden: true });
  days.forEach((d, i) => {
    const x = padL + i * slot + 1;
    const bh = Math.max(d.views ? 2 : 0, plotH - (y(d.views) - padT));
    if (bh > 0) {
      const r = Math.min(4, bw / 2, bh);
      // Rounded top, square bottom anchored to the baseline.
      add('path', { class: 'bar', d: `M${x},${padT + plotH} V${padT + plotH - bh + r} Q${x},${padT + plotH - bh} ${x + r},${padT + plotH - bh} H${x + bw - r} Q${x + bw},${padT + plotH - bh} ${x + bw},${padT + plotH - bh + r} V${padT + plotH} Z` });
    }
    if (i % 5 === 0 || i === days.length - 1) add('text', { x: x + bw / 2, y: H - 6, class: 'axis', 'text-anchor': 'middle' }).textContent = d.day.slice(5);
    const hit = add('rect', { x: padL + i * slot, y: padT, width: slot, height: plotH, class: 'hit', tabindex: 0, 'aria-label': `${d.day}: ${d.views} views, ${d.unique} unique` });
    const show = () => {
      tip.hidden = false;
      tip.replaceChildren(h('b', {}, new Date(d.day + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })), h('div', {}, `${fmtNum(d.views)} views`), h('div', { class: 'muted' }, `${fmtNum(d.unique)} unique`));
      tip.style.left = `${((padL + i * slot + slot / 2) / W) * 100}%`;
      hit.classList.add('on');
    };
    const hide = () => { tip.hidden = true; hit.classList.remove('on'); };
    hit.addEventListener('pointerenter', show);
    hit.addEventListener('focus', show);
    hit.addEventListener('pointerleave', hide);
    hit.addEventListener('blur', hide);
  });
  return h('div', { class: 'chart-wrap' }, svg, tip);
}

function barList(title, rows, labelFn = (k) => k) {
  const total = rows.reduce((a, r) => a + r[1], 0) || 1;
  return h('div', { class: 'panel' }, h('h4', {}, title),
    rows.length ? h('div', { class: 'barlist' }, rows.map(([k, v]) => h('div', { class: 'bl-row' },
      h('div', { class: 'bl-fill', style: { width: `${(v / total) * 100}%` } }),
      h('span', { class: 'bl-label ell' }, labelFn(k)), h('span', { class: 'bl-val' }, fmtNum(v)))))
      : h('p', { class: 'muted small' }, 'No data yet.'));
}

export async function overview(ctx) {
  const root = h('div', { class: 'overview' }, h('p', { class: 'muted' }, 'Loading stats…'));
  const load = async () => {
    let s;
    try { s = await api('GET', '/stats'); } catch (err) { root.replaceChildren(h('p', { class: 'err' }, err.message)); return; }
    const url = location.origin + '/';
    const tile = (label, value, sub) => h('div', { class: 'tile' }, h('div', { class: 'tile-label' }, label), h('div', { class: 'tile-value' }, value), sub ? h('div', { class: 'tile-sub muted' }, sub) : null);
    const linkLabel = (id) => {
      const all = [...(ctx.cfg.links.items || []), ...(ctx.cfg.links.buttons || [])];
      const item = all.find((l) => l.id === id);
      if (!item) return 'removed link';
      return item.label || (item.platform ? platformById(item.platform).name : 'link') + (item.value ? ` · ${item.value}` : '');
    };
    let tableOpen = false;
    const tableSlot = h('div', {});
    const chartPanel = h('div', { class: 'panel' },
      h('div', { class: 'panel-head' }, h('h4', {}, 'Daily views · last 30 days'),
        h('button', { type: 'button', class: 'btn small ghost', onclick: (e) => {
          tableOpen = !tableOpen;
          e.currentTarget.lastChild.textContent = tableOpen ? 'Hide table' : 'Show table';
          tableSlot.replaceChildren(tableOpen ? h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Day'), h('th', {}, 'Views'), h('th', {}, 'Unique'))),
            h('tbody', {}, [...s.days].reverse().map((d) => h('tr', {}, h('td', {}, d.day), h('td', {}, fmtNum(d.views)), h('td', {}, fmtNum(d.unique)))))) : '');
        } }, icon('lu:list-music'), h('span', {}, 'Show table'))),
      dailyChart(s.days), tableSlot);

    root.replaceChildren(
      h('div', { class: 'share' },
        h('div', {}, h('div', { class: 'tile-label' }, 'Your page'), h('a', { href: url, target: '_blank', class: 'share-url' }, url.replace(/^https?:\/\//, ''))),
        h('div', { class: 'row-gap' },
          h('button', { type: 'button', class: 'btn small', onclick: async () => { await copyText(url); toast('Link copied'); } }, icon('lu:copy'), 'Copy link'),
          h('a', { class: 'btn small ghost', href: url, target: '_blank' }, icon('lu:external-link'), 'Open'))),
      h('div', { class: 'tiles' },
        tile('Views shown on page', fmtNum(s.displayed), ctx.cfg.views.offset ? `includes ${fmtNum(ctx.cfg.views.offset)} carried over` : ctx.cfg.views.mode === 'unique' ? 'unique visitors' : 'every visit'),
        tile('Unique visitors', fmtNum(s.unique), 'all time'),
        tile('Page loads', fmtNum(s.total), 'all time'),
        tile('Today', fmtNum(s.today.views), `${fmtNum(s.today.unique)} unique`),
        tile('Last 7 days', fmtNum(s.week.views), `${fmtNum(s.week.unique)} unique`),
        tile('Last 30 days', fmtNum(s.month.views), `${fmtNum(s.month.unique)} unique`)),
      chartPanel,
      h('div', { class: 'grid2' },
        barList('Top referrers', s.referrers),
        barList('Link clicks', s.clicks, linkLabel),
        barList('Devices', s.devices),
        barList('Browsers', s.browsers),
        s.countries.length ? barList('Countries', s.countries) : null),
      h('div', { class: 'panel' }, h('h4', {}, 'Recent visits'),
        s.recent.length ? h('table', { class: 'table' }, h('thead', {}, h('tr', {}, h('th', {}, 'When'), h('th', {}, 'From'), h('th', {}, 'Device'), h('th', {}, 'Browser'), h('th', {}, ''))),
          h('tbody', {}, s.recent.map((r) => h('tr', {}, h('td', {}, ago(r.t)), h('td', {}, r.r), h('td', {}, r.d), h('td', {}, r.b), h('td', {}, r.n ? h('span', { class: 'pill' }, 'new') : '')))))
          : h('p', { class: 'muted small' }, 'No visits yet. Share your link!')),
      h('div', { class: 'row-end' },
        h('button', { type: 'button', class: 'btn small ghost', onclick: load }, icon('lu:refresh-cw'), 'Refresh'),
        h('button', { type: 'button', class: 'btn small danger', onclick: async () => {
          if (!await confirmBox('Reset analytics?', 'This clears every view, visitor, referrer and click count. Your "starting views" setting is kept.', 'Reset', true)) return;
          await api('POST', '/stats/reset');
          toast('Analytics reset');
          load();
        } }, icon('lu:trash-2'), 'Reset analytics')));
  };
  load();
  return root;
}

// ---------- themes ----------
export function themes(ctx) {
  // Load each theme's headline font so the cards preview it.
  for (const th of THEMES) {
    const href = fontHref(th.patch.name?.font || th.patch.look?.font);
    if (href && !document.querySelector(`link[href="${href}"]`)) document.head.append(h('link', { rel: 'stylesheet', href }));
  }
  const hasMedia = ['image', 'video', 'slideshow'].includes(ctx.cfg.bg.type);
  const keep = h('input', { type: 'checkbox' });
  keep.checked = hasMedia;
  const applyIt = (th) => {
    ctx.replace(applyTheme(ctx.cfg, th, { keepBackground: keep.checked }));
    toast(`Applied ${th.name} — tweak anything in the other tabs`);
    grid.querySelectorAll('.theme').forEach((el) => el.classList.toggle('on', el.dataset.id === th.id));
  };
  const grid = h('div', { class: 'theme-grid' }, THEMES.map((th) => h('button', {
    type: 'button', class: 'theme' + (ctx.cfg.meta?.theme === th.id ? ' on' : ''), 'data-id': th.id, onclick: () => applyIt(th),
  },
  h('div', { class: 'theme-swatch', style: { background: `linear-gradient(135deg, ${th.swatch[0]}, ${th.swatch[1]})` } },
    h('span', { class: 'theme-font', style: { fontFamily: `'${th.patch.name?.font || th.patch.look?.font || 'Inter'}'`, color: th.patch.look?.textColor || '#fff' } }, 'Aa')),
  h('span', { class: 'theme-name' }, th.name))));
  return h('div', {},
    h('div', { class: 'panel' },
      h('p', { class: 'muted' }, 'Every theme is free. Applying one restyles colors, card, fonts and effects. Your text, links, badges, music and layout stay put, and you can still tweak everything after.'),
      h('div', { class: 'row-gap wrap' },
        h('label', { class: 'check' }, keep, 'Keep my current background'),
        h('button', { type: 'button', class: 'btn small', onclick: () => applyIt(THEMES[Math.floor(Math.random() * THEMES.length)]) }, icon('lu:wand-sparkles'), 'Surprise me'))),
    grid);
}

// ---------- media library ----------
export function media() {
  const root = h('div', {});
  const grid = h('div', { class: 'lib-grid big' });
  const filter = h('select', { class: 'input small-select' }, ['all', 'image', 'video', 'audio', 'font', 'cursor'].map((k) => h('option', { value: k }, k === 'all' ? 'All files' : k[0].toUpperCase() + k.slice(1) + 's')));
  const fileInput = h('input', { type: 'file', multiple: true, hidden: true });
  const urlInput = h('input', { class: 'input', type: 'url', placeholder: 'https://… (image, video, audio, font)' });
  const fmtSize = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
  let items = [];
  const draw = () => {
    const list = items.filter((f) => filter.value === 'all' || f.kind === filter.value);
    grid.replaceChildren(...(list.length ? list.map((f) => {
      const preview = f.kind === 'image' || f.kind === 'cursor' ? h('img', { src: f.url, alt: '', loading: 'lazy' })
        : f.kind === 'video' ? h('video', { src: f.url, muted: true, preload: 'metadata' })
          : f.kind === 'audio' ? h('audio', { src: f.url, controls: true, preload: 'none' })
            : h('span', { class: 'big-ico' }, icon('lu:type'));
      return h('div', { class: 'lib-card' },
        h('div', { class: 'lib-prev' }, preview),
        h('div', { class: 'lib-meta' }, h('div', { class: 'ell', title: f.label }, f.label), h('div', { class: 'muted small' }, `${f.kind} · ${fmtSize(f.size)}`)),
        h('div', { class: 'lib-actions' },
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'copy URL', 'data-tip': 'Copy URL', onclick: async () => { await copyText(location.origin + f.url); toast('URL copied'); } }, icon('lu:copy')),
          h('a', { class: 'icon-btn', href: f.url, target: '_blank', 'aria-label': 'open' }, icon('lu:external-link')),
          h('button', { type: 'button', class: 'icon-btn danger', 'aria-label': 'delete', onclick: async () => {
            if (!await confirmBox('Delete file?', `${f.label} will be removed. Anything still using it will show nothing.`, 'Delete', true)) return;
            await api('DELETE', `/media/${encodeURIComponent(f.name)}`);
            items = items.filter((x) => x !== f);
            draw();
          } }, icon('lu:trash-2'))));
    }) : [h('p', { class: 'muted' }, 'No files yet. Drop files anywhere on this panel to upload.')]));
  };
  const load = async () => { items = await api('GET', '/media'); draw(); };
  const doUpload = async (files) => {
    if (!files.length) return;
    root.classList.add('busy');
    try { await uploadFiles(files); toast(`Uploaded ${files.length} file(s)`); await load(); } catch (err) { toast(err.message); }
    root.classList.remove('busy');
  };
  fileInput.addEventListener('change', () => { doUpload(fileInput.files); fileInput.value = ''; });
  filter.addEventListener('change', draw);
  root.addEventListener('dragover', (e) => { e.preventDefault(); root.classList.add('drop'); });
  root.addEventListener('dragleave', (e) => { if (e.target === root) root.classList.remove('drop'); });
  root.addEventListener('drop', (e) => { e.preventDefault(); root.classList.remove('drop'); doUpload(e.dataTransfer.files); });
  root.append(
    h('div', { class: 'panel' },
      h('div', { class: 'row-gap wrap' },
        h('button', { type: 'button', class: 'btn primary', onclick: () => fileInput.click() }, icon('lu:upload'), 'Upload files'), fileInput, filter),
      h('div', { class: 'row-gap', style: { marginTop: '12px' } }, urlInput,
        h('button', { type: 'button', class: 'btn', onclick: async () => {
          if (!urlInput.value.trim()) return;
          try { await api('POST', '/media/fetch', { url: urlInput.value.trim() }); urlInput.value = ''; toast('Saved to library'); load(); } catch (err) { toast(err.message); }
        } }, icon('lu:download'), 'Import URL')),
      h('p', { class: 'help' }, 'Images, GIFs, videos, audio, fonts and cursors. Files live on your server\'s volume and never expire.')),
    grid);
  load().catch((err) => grid.replaceChildren(h('p', { class: 'err' }, err.message)));
  return root;
}

// ---------- import / backup ----------
export function importer(ctx) {
  const root = h('div', {});
  const result = h('div', {});

  const showPreview = async (payload) => {
    result.replaceChildren(h('p', { class: 'muted' }, 'Reading your guns.lol data…'));
    let r;
    try { r = await api('POST', '/import/guns/preview', { payload }); } catch (err) { result.replaceChildren(h('p', { class: 'err' }, err.message)); return; }
    if (!r.found.length) { result.replaceChildren(h('p', { class: 'err' }, 'Nothing usable was found. Make sure you ran it on your guns.lol profile page (guns.lol/yourname).')); return; }
    const boxes = r.found.map((f) => {
      const cb = h('input', { type: 'checkbox', checked: true });
      cb.checked = true;
      cb.dataset.key = f.key;
      const value = String(f.value).length > 80 ? String(f.value).slice(0, 80) + '…' : String(f.value);
      return h('label', { class: 'imp-row' }, cb, h('span', { class: 'imp-label' }, f.label), h('span', { class: 'imp-val ell muted' }, value));
    });
    const download = h('input', { type: 'checkbox' });
    download.checked = true;
    const go = h('button', { type: 'button', class: 'btn primary' }, icon('lu:download'), 'Import selected');
    go.addEventListener('click', async () => {
      const keys = boxes.map((b) => b.querySelector('input')).filter((c) => c.checked).map((c) => c.dataset.key);
      // Pull in settings that ride along with a chosen field (e.g. bg.type with bg.video).
      const related = { 'bg.video': ['bg.type'], 'bg.image': ['bg.type'], 'bg.color': ['bg.type'], 'profile.avatar': ['profile.avatarSource'], 'profile.banner': ['profile.bannerSource'], 'cursor.image': ['cursor.type'], 'splash.text': ['splash.enabled'], 'look.accent': ['name.glowColor', 'fx.clickColor'], 'name.sparkles': ['name.sparkleColor'], 'fx.vhs': ['fx.scanlines'] };
      const sections = new Set(keys);
      for (const k of keys) for (const extra of related[k] || []) sections.add(extra);
      for (const [sec, fields] of Object.entries(r.patch)) for (const f of Object.keys(fields)) if (!r.found.some((x) => x.key === `${sec}.${f}`) && !Object.values(related).flat().includes(`${sec}.${f}`)) sections.add(`${sec}.${f}`);
      go.disabled = true;
      go.lastChild.textContent = download.checked ? 'Importing & downloading media…' : 'Importing…';
      try {
        const res = await api('POST', '/import/guns/apply', { patch: r.patch, sections: [...sections], download: download.checked });
        ctx.replace(res.config, { saved: true, rerender: false });
        const failed = res.downloads.filter((d) => !d.ok);
        result.replaceChildren(h('div', { class: 'notice ok' }, icon('lu:circle-check'), h('div', {},
          h('b', {}, 'Imported! '), `${keys.length} settings moved over${res.downloads.length ? `, ${res.downloads.length - failed.length}/${res.downloads.length} media files copied to your library` : ''}.`,
          failed.length ? h('div', { class: 'muted small' }, 'Kept the original links for: ' + failed.map((f) => `${f.label} (${f.error})`).join(', ')) : null)));
        toast('guns.lol import complete');
      } catch (err) {
        toast(err.message);
        go.disabled = false;
        go.lastChild.textContent = 'Import selected';
      }
    });
    result.replaceChildren(h('div', { class: 'panel' },
      h('h4', {}, `Found ${r.found.length} things on guns.lol/${payload.user || ''}`),
      h('div', { class: 'imp-list' }, boxes),
      h('label', { class: 'check' }, download, 'Copy avatar, background, music, cursor and badge images into my library (recommended, so they never break)'),
      h('div', { class: 'row-end' }, go)));
  };

  // Receive data straight from the bookmarklet running on guns.lol.
  ctx.onGunsData = (payload) => showPreview(payload);

  const pasteBox = h('textarea', { class: 'input code', rows: 4, placeholder: 'Paste the copied transfer data here…' });
  const transfer = h('div', { class: 'panel' },
    h('h4', {}, 'Transfer from guns.lol'),
    h('p', { class: 'muted' }, 'Moves your bio, avatar, background, music, cursor, colors, effects, socials, badges, Discord ID and even your view count. It runs in your own browser while you\'re signed in to guns.lol, so your guns.lol password never touches this site.'),
    h('ol', { class: 'steps' },
      h('li', {}, 'Drag this button to your bookmarks bar: ', h('a', { class: 'bookmarklet', href: '#', onclick: (e) => { e.preventDefault(); toast('Drag it to your bookmarks bar instead of clicking'); } }, icon('lu:sparkles'), 'trap.larp transfer'), ' (or use "Copy console script" below).'),
      h('li', {}, 'Open ', h('a', { href: 'https://guns.lol/', target: '_blank', rel: 'noopener' }, 'guns.lol'), ', sign in, then go to your profile page: guns.lol/yourname.'),
      h('li', {}, 'Click the bookmark (or paste the script into the browser console with F12 → Console). This dashboard opens with your data ready to review.')),
    h('div', { class: 'row-gap wrap' },
      h('button', { type: 'button', class: 'btn small', onclick: async () => {
        const t = await api('GET', '/transfer');
        await copyText(t.code);
        toast('Console script copied');
      } }, icon('lu:copy'), 'Copy console script')),
    h('details', { class: 'details' }, h('summary', {}, 'Data didn\'t arrive automatically? Paste it here'),
      pasteBox,
      h('div', { class: 'row-gap wrap' },
        h('button', { type: 'button', class: 'btn small', onclick: () => {
          try { showPreview(JSON.parse(pasteBox.value)); } catch { toast('That isn\'t valid transfer data'); }
        } }, 'Read pasted data'),
        h('label', { class: 'btn small ghost' }, icon('lu:upload'), 'Load .json file', h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async (e) => {
          try { showPreview(JSON.parse(await e.target.files[0].text())); } catch { toast('That file isn\'t valid transfer data'); }
        } })))),
    result);
  api('GET', '/transfer').then((t) => { transfer.querySelector('.bookmarklet').href = t.bookmarklet; }).catch(() => {});

  const snapList = h('div', { class: 'snaps' });
  api('GET', '/snapshots').then((list) => {
    snapList.replaceChildren(...(list.length ? list.map((name) => h('div', { class: 'snap' }, h('span', {}, name.replace(/^config-|\.json$/g, '')),
      h('button', { type: 'button', class: 'btn small ghost', onclick: async () => {
        if (!await confirmBox('Restore this snapshot?', `Your settings go back to how they were at the end of ${name.slice(7, 17)}. Media files aren't affected.`, 'Restore')) return;
        ctx.replace(await api('POST', '/snapshots/restore', { name }), { saved: true });
        toast('Snapshot restored');
      } }, icon('lu:undo-2'), 'Restore'))) : [h('p', { class: 'muted small' }, 'Snapshots appear here after your first save.')]));
  }).catch(() => {});

  const restore = async (data) => {
    if (!await confirmBox('Restore backup?', 'This replaces all of your current settings.', 'Restore')) return;
    ctx.replace(await api('POST', '/import/backup', data), { saved: true });
    toast('Backup restored');
  };
  const backupBox = h('textarea', { class: 'input code', rows: 4, placeholder: 'Paste a copied backup here…' });
  const backup = h('div', { class: 'panel' },
    h('h4', {}, 'Backup & restore'),
    h('div', { class: 'row-gap wrap' },
      // Built from the settings already loaded here, so the copy happens inside the click (Safari needs that).
      h('button', { type: 'button', class: 'btn small', onclick: async () => {
        const ok = await copyText(JSON.stringify({ kind: 'trap.larp-backup', v: 1, exportedAt: new Date().toISOString(), config: ctx.cfg }));
        toast(ok ? 'Backup copied — paste it anywhere to keep it' : 'Couldn\'t copy, use Download backup instead');
      } }, icon('lu:copy'), 'Copy backup'),
      h('a', { class: 'btn small ghost', href: '/api/admin/export', download: '' }, icon('lu:download'), 'Download backup'),
      h('a', { class: 'btn small ghost', href: '/api/admin/export?stats=1', download: '' }, icon('lu:download'), 'Backup incl. analytics'),
      h('label', { class: 'btn small ghost' }, icon('lu:upload'), 'Restore from file', h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async (e) => {
        try { await restore(JSON.parse(await e.target.files[0].text())); } catch (err) { toast(err.message || 'Invalid backup file'); }
      } }))),
    h('details', { class: 'details' }, h('summary', {}, 'Restore a copied backup'),
      backupBox,
      h('div', { class: 'row-gap wrap' },
        h('button', { type: 'button', class: 'btn small', onclick: async () => {
          let data;
          try { data = JSON.parse(backupBox.value); } catch { return toast('That isn\'t a valid backup — paste the whole thing you copied'); }
          try { await restore(data); backupBox.value = ''; } catch (err) { toast(err.message); }
        } }, icon('lu:clipboard-paste'), 'Restore pasted backup'))),
    h('h5', {}, 'Daily snapshots (last 14 days)'), snapList);

  const danger = h('div', { class: 'panel danger-zone' },
    h('h4', {}, 'Start over'),
    h('p', { class: 'muted small' }, 'Resets every setting to the defaults. Media files and analytics are kept.'),
    h('button', { type: 'button', class: 'btn small danger', onclick: async () => {
      if (!await confirmBox('Reset all settings?', 'Everything goes back to defaults. You can undo with a snapshot.', 'Reset everything', true)) return;
      ctx.replace(await api('POST', '/import/backup', { profile: {} }), { saved: true });
      toast('Settings reset');
    } }, icon('lu:trash-2'), 'Reset settings'));

  root.append(transfer, backup, danger);
  return root;
}

// ---------- comments (moderation) ----------
export function comments() {
  const list = h('div', { class: 'cm-admin' });
  const more = h('button', { type: 'button', class: 'btn small ghost', hidden: true }, 'Show older');
  let last = 0;
  const row = (c) => {
    const el = h('div', { class: 'cm-admin-row' },
      c.avatar ? h('img', { class: 'cm-admin-av', src: c.avatar, alt: '', loading: 'lazy' }) : h('span', { class: 'cm-admin-av' }, [...c.name][0]?.toUpperCase() || '?'),
      h('div', { class: 'cm-admin-body' },
        h('div', {}, h('b', {}, c.name), ' ', h('span', { class: 'muted' }, `@${c.username} · ${new Date(c.at).toLocaleString()}`)),
        h('div', { class: 'cm-admin-text' }, c.text)),
      h('button', { type: 'button', class: 'btn small danger', onclick: async () => {
        if (!await confirmBox('Delete this comment?', 'It disappears from your page. Its author still can\'t post another one from the same connection.', 'Delete', true)) return;
        try {
          await api('DELETE', `/comments/${encodeURIComponent(c.id)}`);
          el.remove();
          if (!list.children.length) list.append(h('p', { class: 'muted small' }, 'No comments yet.'));
          toast('Comment deleted');
        } catch (err) { toast(err.message); }
      } }, icon('lu:trash-2'), 'Delete'));
    return el;
  };
  const load = async (before) => {
    more.disabled = true;
    try {
      const data = await api('GET', `/comments${before ? `?before=${before}` : ''}`);
      if (!before) list.replaceChildren();
      list.append(...data.comments.map(row));
      if (!list.children.length) list.append(h('p', { class: 'muted small' }, 'No comments yet.'));
      last = data.comments.at(-1)?.at || last;
      more.hidden = !data.more;
    } catch (err) {
      list.replaceChildren(h('p', { class: 'muted small' }, err.message));
    } finally {
      more.disabled = false;
    }
  };
  more.addEventListener('click', () => load(last));
  load();
  return h('div', { class: 'panel' }, h('h4', {}, 'Comments on your page'), list, more);
}
