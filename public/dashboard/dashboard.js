import { h, icon, addIcons, toast } from '/static/profile/util.js';
import { SECTIONS, getPath, setPath, withDefaults } from '/shared/schema.js';
import { api, renderField } from './fields.js';
import { overview, themes, media, importer, comments } from './sections.js';

const DASH = window.__DASH__ || {};
const store = {
  get(k, d) { try { const v = localStorage.getItem('tl:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('tl:' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const newId = () => Math.random().toString(36).slice(2, 12);

const ctx = {
  cfg: null,
  savedJson: '',
  redraws: [],
  rows: [],
  onGunsData: null,
  get(path) { return getPath(this.cfg, path); },
  set(path, v) { setPath(this.cfg, path, v); this.changed(); },
  changed() {
    for (const row of this.rows) row._vis?.();
    ensureIds(this.cfg);
    pushPreview();
    updateStatus();
    if (autosave) scheduleSave();
  },
  replace(cfg, { saved = false, rerender = true } = {}) {
    this.cfg = withDefaults(cfg);
    ensureIds(this.cfg);
    if (saved) this.savedJson = JSON.stringify(this.cfg);
    if (rerender) showSection(current, { keepScroll: true });
    pushPreview();
    updateStatus();
    if (!saved && autosave) scheduleSave();
  },
};

// Links and buttons get stable ids so click stats survive reordering.
function ensureIds(cfg) {
  for (const list of [cfg.links.items, cfg.links.buttons]) for (const item of list || []) if (!item.id) item.id = newId();
}

// ---------- shell ----------
let current = store.get('section', 'overview');
let autosave = store.get('autosave', true);
let device = store.get('device', 'desktop');
let previewOpen = store.get('preview', window.innerWidth > 1100);

const content = h('div', { class: 'content' });
const title = h('h2', { class: 'top-title' });
const statusEl = h('span', { class: 'status' });
const saveBtn = h('button', { type: 'button', class: 'btn primary', onclick: () => save() }, icon('lu:save'), h('span', {}, 'Save'));
const autoCb = h('input', { type: 'checkbox' });
autoCb.checked = autosave;
autoCb.addEventListener('change', () => { autosave = autoCb.checked; store.set('autosave', autosave); if (autosave && isDirty()) scheduleSave(); });
const nav = h('nav', { class: 'nav' });
const search = h('input', { class: 'input search', type: 'search', placeholder: 'Search settings…', 'aria-label': 'Search settings' });
const iframe = h('iframe', { class: 'preview-frame', src: '/?preview=1', title: 'Live preview' });
const frameBox = h('div', { class: 'frame-box' }, iframe);
const deviceBtns = {
  desktop: h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'desktop preview', onclick: () => setDevice('desktop') }, icon('lu:monitor')),
  mobile: h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'mobile preview', onclick: () => setDevice('mobile') }, icon('lu:smartphone')),
};
const preview = h('section', { class: 'preview' },
  h('div', { class: 'preview-bar' },
    h('span', { class: 'preview-title' }, h('span', { class: 'live-dot' }), 'Live preview'),
    deviceBtns.desktop, deviceBtns.mobile,
    h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'replay intro', 'data-tip': 'Replay enter screen', onclick: () => iframe.contentWindow?.postMessage({ type: 'traplarp:replay' }, location.origin) }, icon('lu:play')),
    h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'reload preview', onclick: () => { iframe.src = '/?preview=1'; } }, icon('lu:refresh-cw')),
    h('a', { class: 'icon-btn', href: '/', target: '_blank', 'aria-label': 'open page' }, icon('lu:external-link'))),
  frameBox);
const shell = h('div', { class: 'shell' + (previewOpen ? ' with-preview' : '') },
  h('aside', { class: 'side' },
    h('div', { class: 'brand' }, h('span', {}, 'trap'), h('b', {}, '.larp')),
    search, nav,
    h('div', { class: 'side-foot' },
      h('a', { class: 'side-link', href: '/', target: '_blank' }, icon('lu:external-link'), 'View my page'),
      h('button', { type: 'button', class: 'side-link', onclick: async () => { await fetch('/api/auth/logout', { method: 'POST', headers: { 'x-trap': '1' } }); location.reload(); } }, icon('lu:log-out'), 'Sign out'))),
  h('main', { class: 'main' },
    h('header', { class: 'top' },
      h('button', { type: 'button', class: 'icon-btn menu-btn', 'aria-label': 'menu', onclick: () => shell.classList.toggle('nav-open') }, icon('lu:menu')),
      title, statusEl,
      h('label', { class: 'check auto' }, autoCb, 'Autosave'),
      saveBtn,
      h('button', { type: 'button', class: 'btn ghost preview-toggle', onclick: () => togglePreview() }, icon('lu:eye'), h('span', {}, 'Preview'))),
    DASH.ephemeral ? h('div', { class: 'notice warn' }, icon('lu:circle-alert'), h('div', {}, h('b', {}, 'No volume attached. '), 'Railway wipes the disk on every deploy, so your settings and uploads will disappear. In Railway: your service → Settings → Volumes → add a volume mounted at ', h('code', {}, '/data'), '.')) : null,
    DASH.weakPassword ? h('div', { class: 'notice warn' }, icon('lu:circle-alert'), h('div', {}, h('b', {}, 'Your dashboard password is short. '), 'Anyone who guesses it can change your page. Set ', h('code', {}, 'DASHBOARD_PASSWORD'), ' to at least 12 characters (a few random words works well) and redeploy.')) : null,
    content),
  preview);
document.getElementById('dash').append(shell);

function togglePreview() {
  previewOpen = !previewOpen;
  store.set('preview', previewOpen);
  shell.classList.toggle('with-preview', previewOpen);
  fitFrame();
}

function setDevice(d) {
  device = d;
  store.set('device', d);
  fitFrame();
}

// Render the preview at a real device width and scale it down to fit the pane.
function fitFrame() {
  deviceBtns.desktop.classList.toggle('on', device === 'desktop');
  deviceBtns.mobile.classList.toggle('on', device === 'mobile');
  const W = frameBox.clientWidth; const H = frameBox.clientHeight;
  if (!W || !H) return;
  const vw = device === 'mobile' ? 390 : 1366;
  const vh = device === 'mobile' ? 844 : Math.round((H / W) * 1366);
  const scale = Math.min(W / vw, H / vh);
  Object.assign(iframe.style, { width: vw + 'px', height: vh + 'px', transform: `scale(${scale})`, left: `${(W - vw * scale) / 2}px` });
  frameBox.classList.toggle('mobile', device === 'mobile');
}
new ResizeObserver(fitFrame).observe(frameBox);

// ---------- nav + search ----------
function drawNav() {
  nav.replaceChildren(...SECTIONS.map((s) => h('button', { type: 'button', class: 'nav-item' + (s.id === current ? ' on' : ''), 'data-id': s.id, onclick: () => { showSection(s.id); shell.classList.remove('nav-open'); } }, icon(s.icon), h('span', {}, s.label))));
}

const searchIndex = [];
for (const s of SECTIONS) for (const g of s.groups || []) for (const f of g.fields) if (f.label) searchIndex.push({ section: s, group: g, field: f, text: `${f.label} ${g.title} ${s.label} ${f.help || ''}`.toLowerCase() });

search.addEventListener('input', () => {
  const q = search.value.trim().toLowerCase();
  if (!q) { drawNav(); return; }
  const hits = searchIndex.filter((x) => q.split(/\s+/).every((w) => x.text.includes(w))).slice(0, 30);
  nav.replaceChildren(...(hits.length ? hits.map((x) => h('button', { type: 'button', class: 'nav-item result', onclick: () => {
    search.value = '';
    drawNav();
    showSection(x.section.id);
    shell.classList.remove('nav-open');
    const row = content.querySelector(`.field[data-key="${CSS.escape(x.field.key)}"]`);
    if (row) {
      if (row.hidden) toast('That option appears once its parent setting is turned on');
      row.scrollIntoView({ block: 'center', behavior: 'smooth' });
      row.classList.add('flash');
      setTimeout(() => row.classList.remove('flash'), 1600);
    }
  } }, icon(x.section.icon), h('span', {}, h('span', { class: 'r-label' }, x.field.label), h('span', { class: 'r-where' }, `${x.section.label} › ${x.group.title}`)))) : [h('p', { class: 'muted small pad' }, 'No settings match.')]));
});

// ---------- sections ----------
function showSection(id, { keepScroll = false } = {}) {
  const section = SECTIONS.find((s) => s.id === id) || SECTIONS[0];
  current = section.id;
  store.set('section', current);
  const scroll = keepScroll ? content.scrollTop : 0;
  drawNav();
  title.replaceChildren(icon(section.icon), h('span', {}, section.label));
  ctx.redraws = [];
  let body;
  if (section.custom === 'overview') body = h('div', {}, overviewPlaceholder());
  else if (section.custom === 'themes') body = themes(ctx);
  else if (section.custom === 'media') body = media(ctx);
  else if (section.custom === 'import') body = importer(ctx);
  else if (section.custom === 'comments') body = h('div', {}, groupsBody(section), comments());
  else body = groupsBody(section);
  content.replaceChildren(body);
  ctx.rows = [...content.querySelectorAll('.field')];
  content.scrollTop = scroll;
}

function groupsBody(section) {
  return h('div', { class: 'groups' }, section.groups.map((g) => h('div', { class: 'panel' },
    h('h4', {}, g.title), g.desc ? h('p', { class: 'muted small' }, g.desc) : null,
    h('div', { class: 'fields' }, g.fields.map((f) => renderField(f, { get: () => getPath(ctx.cfg, f.key), set: (v) => ctx.set(f.key, v) }, ctx))))));
}

function overviewPlaceholder() {
  const slot = h('div', {});
  overview(ctx).then((el) => slot.replaceChildren(el));
  return slot;
}

// ---------- saving ----------
const isDirty = () => ctx.cfg && JSON.stringify(ctx.cfg) !== ctx.savedJson;
let saving = false;
let queued = false;
let saveTimer = null;
let saveError = null;

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => save(), 900);
}

async function save() {
  clearTimeout(saveTimer);
  if (!isDirty()) { updateStatus(); return; }
  if (saving) { queued = true; return; }
  saving = true;
  saveError = null;
  updateStatus();
  const snapshot = JSON.stringify(ctx.cfg);
  try {
    await api('PUT', '/config', JSON.parse(snapshot));
    ctx.savedJson = snapshot;
  } catch (err) {
    saveError = err.message;
    toast('Save failed: ' + err.message);
  }
  saving = false;
  updateStatus();
  if (queued) { queued = false; save(); }
}

function updateStatus() {
  const dirty = isDirty();
  statusEl.className = 'status ' + (saving ? 'saving' : saveError ? 'error' : dirty ? 'dirty' : 'saved');
  statusEl.replaceChildren(icon(saving ? 'lu:refresh-cw' : saveError ? 'lu:circle-alert' : dirty ? 'lu:circle-alert' : 'lu:circle-check'), h('span', {}, saving ? 'Saving…' : saveError ? 'Not saved' : dirty ? 'Unsaved changes' : 'All changes saved'));
  saveBtn.disabled = !dirty || saving;
}

window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
});
window.addEventListener('beforeunload', (e) => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });

// ---------- preview sync ----------
let previewTimer = null;
function pushPreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    iframe.contentWindow?.postMessage({ type: 'traplarp:config', config: ctx.cfg }, location.origin);
  }, 120);
}

// ---------- guns.lol handoff ----------
let gunsReceived = false;
window.addEventListener('message', (e) => {
  if (e.origin === location.origin && e.data?.type === 'traplarp:preview-ready') { pushPreview(); return; }
  if (!/^https:\/\/([a-z0-9-]+\.)*guns\.lol$/i.test(e.origin)) return;
  if (!e.data || e.data.type !== 'traplarp:guns-data' || typeof e.data.payload !== 'object') return;
  gunsReceived = true;
  e.source?.postMessage({ type: 'traplarp:received' }, e.origin);
  if (current !== 'import') showSection('import');
  ctx.onGunsData?.(e.data.payload);
  toast('Got your guns.lol data. Review it below.');
});

function waitForGuns() {
  if (location.hash !== '#import-guns') return;
  history.replaceState(null, '', location.pathname);
  showSection('import');
  if (!window.opener) return;
  let tries = 0;
  const ping = setInterval(() => {
    if (gunsReceived || ++tries > 60) { clearInterval(ping); return; }
    try { window.opener.postMessage({ type: 'traplarp:ready' }, '*'); } catch { clearInterval(ping); }
  }, 500);
}

// ---------- boot ----------
(async () => {
  content.replaceChildren(h('p', { class: 'muted pad' }, 'Loading…'));
  const [cfg, icons] = await Promise.all([api('GET', '/config'), api('GET', '/icons').catch(() => ({}))]);
  addIcons(icons);
  ctx.cfg = withDefaults(cfg);
  ensureIds(ctx.cfg);
  ctx.savedJson = JSON.stringify(ctx.cfg);
  showSection(current);
  updateStatus();
  fitFrame();
  waitForGuns();
})().catch((err) => content.replaceChildren(h('p', { class: 'err pad' }, err.message)));
