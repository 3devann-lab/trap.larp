// Comments card: the list (loaded when it scrolls into view) and the form to leave one.
// Everything from the server is inserted as text, never as HTML.
import { h, icon } from './util.js';

const MAX_TEXT = 200;
const MAX_BYTES = 3 * 1024 * 1024;
const TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const chars = (s) => [...s].length;

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
function ago(at) {
  const s = (at - Date.now()) / 1000;
  for (const [unit, size] of [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]]) {
    if (Math.abs(s) >= size) return rtf.format(Math.round(s / size), unit);
  }
  return rtf.format(0, 'second');
}

async function api(path, opts) {
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong.'), { status: res.status });
  return data;
}

function item(c) {
  const letter = h('span', { class: 'cm-av cm-av-letter', 'aria-hidden': 'true' }, [...c.name][0]?.toUpperCase() || '?');
  let av = letter;
  if (c.avatar && /^\/api\/comments\/avatar\/[\w-]{12}\.(png|jpg|webp)$/.test(c.avatar)) {
    av = h('img', { class: 'cm-av', src: c.avatar, alt: '', width: 36, height: 36, loading: 'lazy', decoding: 'async' });
    av.onerror = () => av.replaceWith(letter);
  }
  return h('li', { class: 'cm' }, av,
    h('div', { class: 'cm-body' },
      h('div', { class: 'cm-head' }, h('b', { class: 'cm-name ell' }, c.name), h('span', { class: 'cm-user ell' }, '@' + c.username), h('time', { datetime: new Date(c.at).toISOString(), title: new Date(c.at).toLocaleString() }, ago(c.at))),
      h('p', { class: 'cm-text' }, c.text)));
}

// Shrinks the picture to 256×256 (cropped square, re-encoded) before sending: smaller, and it
// drops hidden data like the photo's location. Animated files keep only their first frame.
async function shrink(file) {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const size = Math.min(256, side);
  const canvas = h('canvas', { width: size, height: size });
  canvas.getContext('2d').drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  bmp.close?.();
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.85));
  const out = blob?.type === 'image/webp' ? blob : await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const bytes = new Uint8Array(await out.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { base64: btoa(bin), url: URL.createObjectURL(out) };
}

function form(state, onPosted) {
  const err = h('p', { class: 'cm-error', role: 'alert', hidden: true });
  const fail = (msg) => { err.textContent = msg; err.hidden = !msg; };
  const name = h('input', { class: 'cm-input', name: 'name', maxlength: 32, placeholder: 'Display name', autocomplete: 'nickname', required: true });
  const username = h('input', { class: 'cm-input', name: 'username', maxlength: 25, placeholder: '@username', autocomplete: 'off', spellcheck: 'false', required: true });
  const text = h('textarea', { class: 'cm-input cm-textarea', name: 'text', rows: 3, maxlength: 600, placeholder: 'Say something nice…', required: true });
  const count = h('span', { class: 'cm-count' }, `0/${MAX_TEXT}`);
  // Hidden from people; bots that fill every field get turned away.
  const trap = h('input', { name: 'homepage', tabindex: -1, autocomplete: 'off', 'aria-hidden': 'true', class: 'cm-trap' });
  let avatar = null;
  const avslot = h('span', { class: 'cm-avslot' }, h('span', { class: 'cm-av cm-av-letter' }, icon('lu:image')));
  const file = h('input', { type: 'file', accept: TYPES.join(','), hidden: true });
  const pick = h('button', { type: 'button', class: 'cm-btn ghost', onclick: () => file.click() }, 'Add picture');
  file.addEventListener('change', async () => {
    const f = file.files[0];
    file.value = '';
    if (!f) return;
    if (!TYPES.includes(f.type)) return fail('Pictures must be PNG, JPEG or WebP — no GIFs or videos.');
    if (f.size > MAX_BYTES) return fail('Pictures can be at most 3 MB.');
    try {
      if (avatar) URL.revokeObjectURL(avatar.url);
      avatar = await shrink(f);
      avslot.replaceChildren(h('img', { class: 'cm-av', src: avatar.url, alt: 'Your picture' }));
      pick.textContent = 'Change picture';
      fail('');
    } catch { fail('That picture couldn\'t be read.'); }
  });
  text.addEventListener('input', () => {
    const n = chars(text.value.trim());
    count.textContent = `${n}/${MAX_TEXT}`;
    count.classList.toggle('over', n > MAX_TEXT);
  });
  const submit = h('button', { type: 'submit', class: 'cm-btn' }, 'Post');
  const el = h('form', { class: 'cm-form', novalidate: true },
    h('div', { class: 'cm-row' }, avslot, pick, file),
    h('div', { class: 'cm-row' }, name, username),
    text, trap,
    h('div', { class: 'cm-row cm-foot' }, count, submit),
    err);
  el.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = { name: name.value, username: username.value, text: text.value, homepage: trap.value, avatar: avatar?.base64, token: state.token };
    if (!body.name.trim() || !body.username.trim() || !body.text.trim()) return fail('Fill in your name, username and a message.');
    if (chars(body.text.trim()) > MAX_TEXT) return fail(`Messages can be at most ${MAX_TEXT} characters.`);
    submit.disabled = true;
    try {
      // The server refuses forms sent within 3 seconds of loading them.
      const wait = 3200 - (Date.now() - Number(String(state.token).split('.')[0]));
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      const posted = await api('/api/comments', { method: 'POST', headers: { 'content-type': 'application/json', 'x-trap-comment': '1' }, body: JSON.stringify(body) });
      onPosted(posted);
    } catch (error) {
      fail(error.message);
      if (error.status === 409) onPosted(null);
    } finally {
      submit.disabled = false;
    }
  });
  return el;
}

export function commentsBlock(cfg) {
  const list = h('ul', { class: 'cm-list' });
  const empty = h('p', { class: 'cm-empty muted' }, 'No comments yet. Be the first!');
  const slot = h('div', { class: 'cm-form-slot' });
  const more = h('button', { type: 'button', class: 'cm-btn ghost cm-more', hidden: true }, 'Show more');
  const el = h('div', { class: 'block block-comments' },
    h('h3', { class: 'cm-title' }, icon('lu:message-square'), cfg.comments.title || 'Comments'),
    slot, list, empty, more);
  empty.hidden = true;
  const state = { token: '', last: 0 };

  const done = (text) => slot.replaceChildren(h('p', { class: 'cm-note muted' }, text));
  const showForm = () => slot.replaceChildren(h('button', { type: 'button', class: 'cm-btn', onclick: () => {
    slot.replaceChildren(form(state, (posted) => {
      if (posted) { list.prepend(item(posted)); empty.hidden = true; done('Thanks! Your comment is up.'); } else done('You already left a comment here.');
    }));
    slot.querySelector('input')?.focus();
  } }, 'Leave a comment'));

  const load = async (before) => {
    more.disabled = true;
    try {
      const data = await api(`/api/comments${before ? `?before=${before}` : ''}`);
      state.token = data.token;
      list.append(...data.comments.map(item));
      state.last = data.comments.at(-1)?.at || state.last;
      more.hidden = !data.more;
      empty.hidden = list.children.length > 0;
      if (!before) { if (data.canPost) showForm(); else done('You already left a comment here.'); }
    } catch (error) {
      if (!before) slot.replaceChildren(h('p', { class: 'cm-note muted' }, error.message));
    } finally {
      more.disabled = false;
    }
  };
  more.addEventListener('click', () => load(state.last));

  // Only fetch once the card is close to being seen; most visitors never scroll this far.
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    load();
  }, { rootMargin: '300px' });
  io.observe(el);
  return { el, destroy: () => io.disconnect() };
}
