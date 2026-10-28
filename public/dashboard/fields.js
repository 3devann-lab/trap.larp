// Field editors for the dashboard. Every editor reads/writes through a { get, set } binding.
import { h, icon, toast, isVideo, youtubeId } from '/static/profile/util.js';
import { PLATFORMS, PLATFORM_GROUPS, platformById } from '/shared/platforms.js';
import { BADGE_PRESETS, badgePreset } from '/shared/badges.js';
import { FONTS, fontHref } from '/shared/fonts.js';
import { itemDefaults } from '/shared/schema.js';

export async function api(method, path, body) {
  const opts = { method, headers: { 'x-trap': '1' } };
  if (body instanceof FormData) opts.body = body;
  else if (body !== undefined) { opts.headers['content-type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch('/api/admin' + path, opts);
  if (res.status === 401) { location.reload(); throw new Error('Signed out'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ---------- modal ----------
export function modal(title, body, { wide = false, onClose } = {}) {
  const close = () => { el.remove(); document.removeEventListener('keydown', onKey); onClose?.(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const el = h('div', { class: 'modal-back', onclick: (e) => { if (e.target === el) close(); } },
    h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-label': title },
      h('div', { class: 'modal-head' }, h('h3', {}, title), h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'close', onclick: close }, icon('lu:x'))),
      h('div', { class: 'modal-body' }, body)));
  document.body.append(el);
  document.addEventListener('keydown', onKey);
  return { el, close };
}

export function confirmBox(title, text, okLabel = 'Confirm', danger = false) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); m.close(); } };
    const m = modal(title, h('div', {},
      h('p', { class: 'muted' }, text),
      h('div', { class: 'row-end' },
        h('button', { class: 'btn ghost', type: 'button', onclick: () => finish(false) }, 'Cancel'),
        h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), type: 'button', onclick: () => finish(true) }, okLabel))), { onClose: () => finish(false) });
  });
}

// ---------- icon pickers ----------
function openPicker({ title, items, groups, value, onPick }) {
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Search…', autofocus: true });
  const grid = h('div', { class: 'pick-grid' });
  const draw = () => {
    const q = search.value.trim().toLowerCase();
    grid.replaceChildren();
    for (const g of groups || [null]) {
      const list = items.filter((i) => (!g || i.group === g) && (!q || i.label.toLowerCase().includes(q) || i.value.includes(q)));
      if (!list.length) continue;
      if (g) grid.append(h('div', { class: 'pick-group' }, g));
      for (const it of list) {
        grid.append(h('button', { type: 'button', class: 'pick-item' + (it.value === value ? ' on' : ''), title: it.label, onclick: () => { onPick(it.value); m.close(); } },
          h('span', { class: 'pick-ico', style: { color: it.color || null } }, icon(it.icon)), h('span', { class: 'pick-label' }, it.label)));
      }
    }
  };
  search.addEventListener('input', draw);
  draw();
  const m = modal(title, h('div', { class: 'picker' }, search, grid), { wide: true });
  setTimeout(() => search.focus(), 30);
}

const platformItems = PLATFORMS.map((p) => ({ value: p.id, label: p.name, icon: p.icon, color: p.color === '#ffffff' ? null : p.color, group: p.group }));
const badgeItems = BADGE_PRESETS.map((b) => ({ value: b.id, label: b.label, icon: b.icon, color: b.color }));

function pickerButton(kind, bind) {
  const btn = h('button', { type: 'button', class: 'pick-btn' });
  const draw = () => {
    const v = bind.get();
    const it = kind === 'platform' ? platformById(v) : badgePreset(v) || BADGE_PRESETS[0];
    const color = kind === 'platform' ? (it.color === '#ffffff' ? null : it.color) : it.color;
    btn.replaceChildren(h('span', { class: 'pick-ico', style: { color } }, icon(it.icon)), h('span', {}, kind === 'platform' ? it.name : it.label), icon('lu:chevron-down'));
  };
  btn.addEventListener('click', () => openPicker({
    title: kind === 'platform' ? 'Choose a platform' : 'Choose a badge icon',
    items: kind === 'platform' ? platformItems : badgeItems,
    groups: kind === 'platform' ? PLATFORM_GROUPS : null,
    value: bind.get(),
    onPick: (v) => { bind.set(v); draw(); },
  }));
  draw();
  return btn;
}

// ---------- media ----------
const ACCEPT = { image: 'image/*', video: 'video/*', audio: 'audio/*', font: '.ttf,.otf,.woff,.woff2', cursor: '.cur,.ani' };
const acceptFor = (accept) => String(accept || 'image').split(',').map((k) => ACCEPT[k.trim()] || '').filter(Boolean).join(',');
const kindOf = (url) => {
  const u = String(url || '').toLowerCase();
  if (youtubeId(url)) return 'youtube';
  if (isVideo(u)) return 'video';
  if (/\.(mp3|ogg|wav|m4a|aac|flac|opus|weba)(\?|$)/.test(u)) return 'audio';
  if (/\.(woff2?|ttf|otf)(\?|$)/.test(u)) return 'font';
  return 'image';
};

export async function uploadFiles(files) {
  const fd = new FormData();
  for (const f of files) fd.append('files', f);
  return api('POST', '/media', fd);
}

function mediaThumb(url) {
  const box = h('div', { class: 'thumb' });
  if (!url) { box.append(icon('lu:image')); box.classList.add('empty'); return box; }
  const kind = kindOf(url);
  if (kind === 'youtube') box.append(h('img', { src: `https://i.ytimg.com/vi/${youtubeId(url)}/mqdefault.jpg`, alt: '' }));
  else if (kind === 'video') box.append(h('video', { src: url, muted: true, loop: true, autoplay: true, playsinline: true }));
  else if (kind === 'audio') {
    const audio = h('audio', { src: url, preload: 'none' });
    const btn = h('button', { type: 'button', class: 'thumb-play', 'aria-label': 'preview', onclick: () => { if (audio.paused) { audio.play(); btn.replaceChildren(icon('lu:pause')); } else { audio.pause(); btn.replaceChildren(icon('lu:play')); } } }, icon('lu:play'));
    audio.onended = () => btn.replaceChildren(icon('lu:play'));
    box.append(audio, btn);
  } else if (kind === 'font') {
    const fam = 'f' + Math.random().toString(36).slice(2);
    box.append(h('style', {}, `@font-face{font-family:${fam};src:url("${url}")}`), h('span', { style: { fontFamily: fam, fontSize: '20px' } }, 'Aa'));
  } else {
    const img = h('img', { src: url, alt: '' });
    img.onerror = () => { img.remove(); box.append(icon('lu:circle-alert')); };
    box.append(img);
  }
  return box;
}

export async function openLibrary(accept, onPick) {
  const kinds = String(accept || 'image').split(',').map((s) => s.trim());
  const grid = h('div', { class: 'lib-grid' }, h('p', { class: 'muted' }, 'Loading…'));
  const m = modal('Media library', h('div', {}, grid), { wide: true });
  try {
    const items = (await api('GET', '/media')).filter((f) => kinds.includes(f.kind) || (kinds.includes('cursor') && f.kind === 'image'));
    grid.replaceChildren();
    if (!items.length) grid.append(h('p', { class: 'muted' }, 'Nothing here yet — upload something first.'));
    for (const f of items) {
      grid.append(h('button', { type: 'button', class: 'lib-item', onclick: () => { onPick(f.url); m.close(); } }, mediaThumb(f.url), h('span', { class: 'ell' }, f.label)));
    }
  } catch (err) {
    grid.replaceChildren(h('p', { class: 'err' }, err.message));
  }
}

function mediaField(field, bind) {
  const wrap = h('div', { class: 'media' });
  const input = h('input', { class: 'input', type: 'text', placeholder: field.placeholder || 'Upload a file or paste a URL', value: bind.get() || '' });
  const file = h('input', { type: 'file', accept: acceptFor(field.accept), hidden: true });
  const thumbSlot = h('div', {});
  const saveRemote = h('button', { type: 'button', class: 'btn small ghost', title: 'Copy this file into your own media library so it never breaks', onclick: async () => {
    saveRemote.disabled = true;
    try { const r = await api('POST', '/media/fetch', { url: input.value }); setValue(r.url); toast('Saved to your library'); } catch (err) { toast(err.message); }
    saveRemote.disabled = false;
  } }, icon('lu:download'), 'Save copy');
  const setValue = (v) => {
    input.value = v || '';
    bind.set(input.value.trim());
    draw();
  };
  const draw = () => {
    thumbSlot.replaceChildren(mediaThumb(input.value.trim()));
    saveRemote.hidden = !/^https?:\/\//i.test(input.value.trim()) || kindOf(input.value.trim()) === 'youtube';
  };
  input.addEventListener('change', () => setValue(input.value));
  input.addEventListener('input', () => bind.set(input.value.trim()));
  file.addEventListener('change', async () => {
    if (!file.files.length) return;
    wrap.classList.add('busy');
    try { const [f] = await uploadFiles(file.files); setValue(f.url); } catch (err) { toast(err.message); }
    wrap.classList.remove('busy');
    file.value = '';
  });
  wrap.addEventListener('dragover', (e) => { e.preventDefault(); wrap.classList.add('drop'); });
  wrap.addEventListener('dragleave', () => wrap.classList.remove('drop'));
  wrap.addEventListener('drop', async (e) => {
    e.preventDefault();
    wrap.classList.remove('drop');
    if (!e.dataTransfer.files.length) return;
    wrap.classList.add('busy');
    try { const [f] = await uploadFiles([e.dataTransfer.files[0]]); setValue(f.url); } catch (err) { toast(err.message); }
    wrap.classList.remove('busy');
  });
  wrap.append(thumbSlot, h('div', { class: 'media-main' }, input,
    h('div', { class: 'media-actions' },
      h('button', { type: 'button', class: 'btn small', onclick: () => file.click() }, icon('lu:upload'), 'Upload'),
      h('button', { type: 'button', class: 'btn small ghost', onclick: () => openLibrary(field.accept, setValue) }, icon('lu:folder-open'), 'Library'),
      saveRemote,
      h('button', { type: 'button', class: 'btn small ghost', 'aria-label': 'clear', onclick: () => setValue('') }, icon('lu:x')))), file);
  draw();
  return wrap;
}

function mediaListField(field, bind, ctx) {
  const wrap = h('div', { class: 'media-list' });
  const draw = () => {
    const list = bind.get() || [];
    wrap.replaceChildren(...list.map((url, i) => h('div', { class: 'ml-item' }, mediaThumb(url),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'remove', onclick: () => { const l = [...list]; l.splice(i, 1); bind.set(l); draw(); } }, icon('lu:x')))),
    h('button', { type: 'button', class: 'ml-add', onclick: () => openLibrary(field.accept, (u) => { bind.set([...(bind.get() || []), u]); draw(); }) }, icon('lu:plus'), 'Add from library'),
    h('label', { class: 'ml-add' }, icon('lu:upload'), 'Upload', h('input', { type: 'file', multiple: true, accept: acceptFor(field.accept), hidden: true, onchange: async (e) => {
      try { const files = await uploadFiles(e.target.files); bind.set([...(bind.get() || []), ...files.map((f) => f.url)]); draw(); } catch (err) { toast(err.message); }
    } })));
  };
  draw();
  ctx.redraws.push(draw);
  return wrap;
}

// ---------- order ----------
function orderField(field, bind) {
  const wrap = h('div', { class: 'order' });
  const label = (v) => field.options.find((o) => o.value === v)?.label || v;
  let dragFrom = null;
  const draw = () => {
    const all = field.options.map((o) => o.value);
    const list = [...new Set([...(bind.get() || []).filter((v) => all.includes(v)), ...all])];
    const move = (i, d) => { const l = [...list]; const [x] = l.splice(i, 1); l.splice(i + d, 0, x); bind.set(l); draw(); };
    wrap.replaceChildren(...list.map((v, i) => {
      const row = h('div', { class: 'order-row', draggable: 'true' },
        h('span', { class: 'grip' }, icon('lu:grip-vertical')), h('span', { class: 'order-label' }, label(v)),
        h('button', { type: 'button', class: 'icon-btn', disabled: i === 0, 'aria-label': 'move up', onclick: () => move(i, -1) }, icon('lu:chevron-up')),
        h('button', { type: 'button', class: 'icon-btn', disabled: i === list.length - 1, 'aria-label': 'move down', onclick: () => move(i, 1) }, icon('lu:chevron-down')));
      row.addEventListener('dragstart', () => { dragFrom = i; row.classList.add('dragging'); });
      row.addEventListener('dragend', () => row.classList.remove('dragging'));
      row.addEventListener('dragover', (e) => e.preventDefault());
      row.addEventListener('drop', (e) => { e.preventDefault(); if (dragFrom === null || dragFrom === i) return; const l = [...list]; const [x] = l.splice(dragFrom, 1); l.splice(i, 0, x); dragFrom = null; bind.set(l); draw(); });
      return row;
    }));
  };
  draw();
  return wrap;
}

// ---------- profile effect picker ----------
let effectsCache = null;
function effectPicker(field, bind) {
  const wrap = h('div', { class: 'effects' });
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Search effects…' });
  const grid = h('div', { class: 'effect-grid' }, h('p', { class: 'muted' }, 'Loading effects…'));
  const draw = (list) => {
    const q = search.value.trim().toLowerCase();
    grid.replaceChildren(...list.filter((e) => !q || e.title.toLowerCase().includes(q)).map((e) => {
      const btn = h('button', { type: 'button', class: 'effect-item' + (bind.get() === e.id ? ' on' : ''), title: e.description || e.title, onclick: () => {
        bind.set(e.id);
        grid.querySelectorAll('.effect-item.on').forEach((x) => x.classList.remove('on'));
        btn.classList.add('on');
      } }, h('img', { src: e.thumb, alt: '', loading: 'lazy' }), h('span', { class: 'ell' }, e.title));
      return btn;
    }));
  };
  (effectsCache ||= api('GET', '/effects')).then((list) => {
    draw(list);
    search.addEventListener('input', () => draw(list));
  }).catch((err) => grid.replaceChildren(h('p', { class: 'err' }, err.message)));
  wrap.append(search, grid);
  return wrap;
}

// ---------- discord connection check ----------
function discordCheck(ctx) {
  const out = h('div', { class: 'dcheck' });
  const run = async () => {
    const id = ctx.get('discord.userId');
    out.replaceChildren(h('p', { class: 'muted' }, 'Checking…'));
    try {
      const r = await api('GET', `/discord/check?id=${encodeURIComponent(id || '')}`);
      const p = r.profile;
      const line = (ok, text) => h('div', { class: 'check-line ' + (ok ? 'ok' : 'bad') }, icon(ok ? 'lu:circle-check' : 'lu:circle-alert'), h('span', {}, text));
      out.replaceChildren(...[
        line(r.lanyard.ok, r.lanyard.ok ? `Live status connected (${r.lanyard.username} is ${r.lanyard.status})` : `Live status unavailable: ${r.lanyard.error}. Join discord.gg/lanyard with this account.`),
        line(Boolean(p), p ? `Profile found: ${p.globalName || p.username}${p.bio ? ', has bio' : ''}, ${p.badges.length} badge(s)${p.effect ? `, effect: ${p.effect.title || p.effect.id}` : ''}${p.decoration ? ', has decoration' : ''}` : 'Couldn\'t load profile details (bio, banner, badges). Live status still works.'),
        p?.effect?.unknown ? line(false, 'Your profile effect is newer than the built-in catalog. Set "Profile effect" to "Custom image URL" and paste its loop.png link instead.') : null].filter(Boolean));
    } catch (err) {
      out.replaceChildren(h('p', { class: 'err' }, err.message));
    }
  };
  return h('div', {}, h('button', { type: 'button', class: 'btn small', onclick: run }, icon('lu:refresh-cw'), 'Check connection'), out);
}

// ---------- list editor ----------
function listField(field, bind, ctx) {
  const wrap = h('div', { class: 'list' });
  const open = new Set();
  let dragFrom = null;
  const draw = () => {
    const list = bind.get() || [];
    const commit = (l) => { bind.set(l); draw(); };
    wrap.replaceChildren(...list.map((item, i) => {
      const title = h('span', { class: 'li-title ell' });
      const lead = h('span', { class: 'li-lead' });
      const refreshHead = () => {
        title.textContent = field.itemTitle ? field.itemTitle(item) : `Item ${i + 1}`;
        lead.replaceChildren();
        if (item.platform) { const p = platformById(item.platform); lead.append(h('span', { style: { color: p.color === '#ffffff' ? null : p.color } }, icon(p.icon))); }
        else if (item.preset) { const b = badgePreset(item.preset); if (b) lead.append(h('span', { style: { color: item.color || b.color } }, icon(b.icon))); }
      };
      refreshHead();
      const body = h('div', { class: 'li-body' });
      const rows = [];
      for (const f of field.item) {
        const row = renderField(f, { get: () => item[f.key], set: (v) => { item[f.key] = v; bind.set(list); refreshHead(); rows.forEach((r) => r._vis?.()); } }, ctx, item);
        rows.push(row);
        body.append(row);
      }
      rows.forEach((r) => r._vis?.());
      const el = h('div', { class: 'li' + (open.has(item) ? ' open' : ''), draggable: 'false' },
        h('div', { class: 'li-head', onclick: (e) => { if (e.target.closest('button')) return; el.classList.toggle('open'); if (el.classList.contains('open')) open.add(item); else open.delete(item); } },
          h('span', { class: 'grip', onmousedown: () => { el.draggable = true; }, onmouseup: () => { el.draggable = false; } }, icon('lu:grip-vertical')),
          lead, title,
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'move up', disabled: i === 0, onclick: () => { const l = [...list]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; commit(l); } }, icon('lu:chevron-up')),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'move down', disabled: i === list.length - 1, onclick: () => { const l = [...list]; [l[i + 1], l[i]] = [l[i], l[i + 1]]; commit(l); } }, icon('lu:chevron-down')),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'duplicate', onclick: () => { const copy = JSON.parse(JSON.stringify(item)); delete copy.id; const l = [...list]; l.splice(i + 1, 0, copy); open.add(copy); commit(l); } }, icon('lu:copy')),
          h('button', { type: 'button', class: 'icon-btn danger', 'aria-label': 'delete', onclick: () => { const l = [...list]; l.splice(i, 1); commit(l); } }, icon('lu:trash-2'))),
        body);
      el.addEventListener('dragstart', () => { dragFrom = i; el.classList.add('dragging'); });
      el.addEventListener('dragend', () => { el.classList.remove('dragging'); el.draggable = false; });
      el.addEventListener('dragover', (e) => e.preventDefault());
      el.addEventListener('drop', (e) => { e.preventDefault(); if (dragFrom === null || dragFrom === i) return; const l = [...list]; const [x] = l.splice(dragFrom, 1); l.splice(i, 0, x); dragFrom = null; commit(l); });
      return el;
    }), h('button', { type: 'button', class: 'btn add-btn', onclick: () => { const item = itemDefaults(field); open.add(item); commit([...(bind.get() || []), item]); } }, icon('lu:plus'), field.addLabel || 'Add'));
  };
  draw();
  ctx.redraws.push(draw);
  return wrap;
}

// ---------- generic field ----------
export function renderField(field, bind, ctx, scope) {
  const row = h('div', { class: `field f-${field.type}`, 'data-key': field.key });
  const label = field.label ? h('label', { class: 'f-label' }, field.label) : null;
  let control;
  const t = field.type;
  if (t === 'text' || t === 'date' || t === 'datetime' || t === 'number') {
    control = h('input', { class: 'input', type: t === 'datetime' ? 'datetime-local' : t, placeholder: field.placeholder || '', value: bind.get() ?? '' });
    control.addEventListener('input', () => bind.set(t === 'number' ? (control.value === '' ? 0 : Number(control.value)) : control.value));
  } else if (t === 'textarea' || t === 'code') {
    control = h('textarea', { class: 'input' + (t === 'code' ? ' code' : ''), rows: t === 'code' ? 8 : 3, spellcheck: t === 'code' ? 'false' : 'true', placeholder: field.placeholder || '' });
    control.value = bind.get() ?? '';
    control.addEventListener('input', () => bind.set(control.value));
    if (t === 'code') control.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      const s = control.selectionStart;
      control.setRangeText('  ', s, control.selectionEnd, 'end');
      bind.set(control.value);
    });
  } else if (t === 'lines') {
    control = h('textarea', { class: 'input', rows: 3, placeholder: 'One per line' });
    control.value = (bind.get() || []).join('\n');
    control.addEventListener('input', () => bind.set(control.value.split('\n').map((s) => s.trim()).filter(Boolean)));
  } else if (t === 'range') {
    const num = h('input', { class: 'input num', type: 'number', min: field.min, max: field.max, step: field.step || 1, value: bind.get() });
    const range = h('input', { class: 'range', type: 'range', min: field.min, max: field.max, step: field.step || 1, value: bind.get() });
    const sync = (v) => { const n = Number(v); range.value = n; num.value = n; range.style.setProperty('--p', ((n - field.min) / (field.max - field.min)) * 100 + '%'); };
    range.addEventListener('input', () => { sync(range.value); bind.set(Number(range.value)); });
    num.addEventListener('input', () => { if (num.value === '') return; sync(num.value); bind.set(Number(num.value)); });
    sync(bind.get());
    control = h('div', { class: 'range-row' }, range, num, field.unit ? h('span', { class: 'unit' }, field.unit) : null);
  } else if (t === 'color') {
    const v = bind.get() || '';
    const picker = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(v) ? v : '#ffffff' });
    const text = h('input', { class: 'input mono', type: 'text', value: v, placeholder: field.allowEmpty ? 'default' : '#ffffff', maxlength: 7 });
    const swatch = h('label', { class: 'swatch' + (v ? '' : ' empty'), style: { background: v || null } }, picker);
    picker.addEventListener('input', () => { text.value = picker.value; swatch.style.background = picker.value; swatch.classList.remove('empty'); bind.set(picker.value); });
    text.addEventListener('input', () => {
      const s = text.value.trim();
      if (/^#[0-9a-f]{6}$/i.test(s)) { picker.value = s; swatch.style.background = s; swatch.classList.remove('empty'); bind.set(s.toLowerCase()); }
      else if (!s && field.allowEmpty) { swatch.style.background = ''; swatch.classList.add('empty'); bind.set(''); }
    });
    control = h('div', { class: 'color-row' }, swatch, text);
  } else if (t === 'toggle') {
    const cb = h('input', { type: 'checkbox' });
    cb.checked = Boolean(bind.get());
    cb.addEventListener('change', () => bind.set(cb.checked));
    control = h('label', { class: 'switch' }, cb, h('span', { class: 'slider' }));
    row.classList.add('inline');
  } else if (t === 'select') {
    control = h('select', { class: 'input' });
    const groups = {};
    for (const o of field.options) {
      const opt = h('option', { value: o.value }, o.label);
      if (o.group) { (groups[o.group] ||= h('optgroup', { label: o.group })).append(opt); if (!groups[o.group].isConnected) control.append(groups[o.group]); }
      else control.append(opt);
    }
    control.value = bind.get() ?? '';
    control.addEventListener('change', () => bind.set(control.value));
    if (field.options.length > 20 && field.options.some((o) => FONTS.some((f) => f.name === o.value))) {
      // Font preview next to the dropdown.
      const preview = h('span', { class: 'font-preview' }, 'The quick brown fox');
      const showFont = () => {
        const name = control.value;
        const href = fontHref(name);
        if (href && !document.querySelector(`link[href="${href}"]`)) document.head.append(h('link', { rel: 'stylesheet', href }));
        preview.style.fontFamily = name ? `'${name}'` : '';
      };
      control.addEventListener('change', showFont);
      showFont();
      control = h('div', { class: 'font-row' }, control, preview);
    }
  } else if (t === 'media') {
    control = mediaField(field, bind);
  } else if (t === 'media-list') {
    control = mediaListField(field, bind, ctx);
  } else if (t === 'order') {
    control = orderField(field, bind);
  } else if (t === 'list') {
    control = listField(field, bind, ctx);
    row.classList.add('wide');
  } else if (t === 'platform' || t === 'badge') {
    control = pickerButton(t, bind);
  } else if (t === 'effect-picker') {
    control = effectPicker(field, bind);
    row.classList.add('wide');
  } else if (t === 'discord-check') {
    control = discordCheck(ctx);
  } else {
    control = h('span', { class: 'muted' }, `Unsupported field: ${t}`);
  }
  if (label) row.append(label);
  row.append(control);
  if (field.help) row.append(h('div', { class: 'help' }, field.help));
  if (field.show) {
    row._vis = () => { row.hidden = !field.show(scope ?? ctx.cfg); };
    row._vis();
  }
  return row;
}
