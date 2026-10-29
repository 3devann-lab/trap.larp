// Firebase Firestore storage, for Vercel (its servers can't keep files between requests).
// Everything lives in Firestore, uploads included (split into 960 KB chunks), so a free
// Spark-plan project is enough. Settings and stats are stored as JSON strings, which keeps
// them clear of Firestore's rules about nested arrays and field names.
//
// GOOGLEFIREBASECONFIG takes either a service account key (Admin SDK, firestore-admin.js) or
// the web app config plus FIREBASE_EMAIL / FIREBASE_PASSWORD (REST, firestore-rest.js).
import crypto from 'node:crypto';
import { FIREBASE_CONFIG, FIREBASE_EMAIL, FIREBASE_PASSWORD } from '../env.js';
import { withDefaults } from '../../shared/schema.js';
import { CHUNK_SIZE, PART_SIZE, fileInfo, typeOf, validName } from '../media.js';
import { restAdapter } from './firestore-rest.js';

// Responses to ranged requests (audio/video seeking) stop at 4 MB to stay under Vercel's
// response limit; browsers ask for the rest as they need it.
const MAX_RANGE = 4 * 1024 * 1024;
const CHUNKS_PER_PART = PART_SIZE / CHUNK_SIZE;

const SETUP = '(see "Deploy on Vercel" in the README), then redeploy.';

async function connect() {
  const raw = FIREBASE_CONFIG.trim();
  if (!raw) throw new Error(`USEVERCEL is on but GOOGLEFIREBASECONFIG is missing. Paste your Firebase web app config or service account key into it ${SETUP}`);
  const text = raw.includes('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');

  let key = null;
  try { key = JSON.parse(text); } catch { /* not JSON: may still be a web config copied as JavaScript */ }
  if (key?.private_key) {
    if (!key.project_id || !key.client_email) throw new Error(`GOOGLEFIREBASECONFIG is missing project_id or client_email. Paste the whole service account .json file ${SETUP}`);
    return (await import('./firestore-admin.js')).adminAdapter(key);
  }

  // The web app config, as JSON or as the `const firebaseConfig = { apiKey: "..." }` snippet.
  const pick = (name) => new RegExp(`["']?${name}["']?\\s*:\\s*["']([^"']+)["']`).exec(text)?.[1];
  const apiKey = pick('apiKey');
  const projectId = pick('projectId');
  if (!apiKey || !projectId) {
    throw new Error(`GOOGLEFIREBASECONFIG doesn't look like a Firebase config. Paste the web app config (the part from { to } with apiKey and projectId) ${SETUP}`);
  }
  if (!FIREBASE_EMAIL || !FIREBASE_PASSWORD) {
    throw new Error(`GOOGLEFIREBASECONFIG holds the web app config, so the server also needs the Firebase user it signs in as: add FIREBASE_EMAIL and FIREBASE_PASSWORD ${SETUP}`);
  }
  return restAdapter({ apiKey, projectId, email: FIREBASE_EMAIL, password: FIREBASE_PASSWORD });
}

// Wait until the response can take more data (or the visitor went away).
const drained = (res) => new Promise((resolve) => {
  const done = () => {
    res.off('drain', done);
    res.off('close', done);
    resolve();
  };
  res.on('drain', done);
  res.on('close', done);
});

const ADMIN_CODES = { 5: 'NOT_FOUND', 7: 'PERMISSION_DENIED', 8: 'RESOURCE_EXHAUSTED', 16: 'UNAUTHENTICATED' };

export async function createStore() {
  const db = await connect();

  const chunkPath = (name, i) => `files/${name}/chunks/${i}`;
  const parse = (doc, fallback) => (doc ? JSON.parse(doc.json) : fallback);
  const emptyStats = () => ({ total: 0, unique: 0, daily: {}, referrers: {}, clicks: {}, devices: {}, browsers: {}, countries: {}, recent: [] });
  const readStats = (doc) => ({ ...emptyStats(), ...parse(doc, {}) });
  const loginPath = (key) => `logins/${crypto.createHash('sha256').update(key).digest('hex').slice(0, 32)}`;

  // Firestore takes at most 500 writes per commit.
  async function commitAll(ops) {
    for (let i = 0; i < ops.length; i += 500) await db.commit(ops.slice(i, i + 500));
  }
  const removeChunks = (name, count, extra) => commitAll([
    ...Array.from({ length: count }, (_, i) => ({ remove: chunkPath(name, i) })),
    ...extra.map((path) => ({ remove: path })),
  ]);

  // Public pages read settings and stats through a 5-second cache, so a flood of page loads
  // costs a bounded number of reads; requests that arrive together share one read. Saving
  // updates this server's copy at once (other servers within 5 seconds); the dashboard reads fresh.
  const ttlCache = (load) => {
    let value = null;
    let at = 0;
    let pending = null;
    const get = ({ fresh } = {}) => {
      if (!fresh && value && Date.now() - at < 5000) return Promise.resolve(value);
      pending ||= load().then((v) => { value = v; at = Date.now(); return v; }).finally(() => { pending = null; });
      return pending;
    };
    get.set = (v) => { value = v; at = Date.now(); };
    return get;
  };
  const configCache = ttlCache(async () => withDefaults(parse(await db.get('site/config'), {})));
  const statsCache = ttlCache(async () => readStats(await db.get('site/stats')));

  let prunedOn = '';
  let saltCache = null;
  let secretCache = null;
  const randomOnce = (path, field, bytes) => db.transaction(async (t) => {
    const doc = await t.get(path);
    if (doc?.[field]) return doc[field];
    const value = crypto.randomBytes(bytes).toString('hex');
    t.set(path, { ...doc, [field]: value });
    return value;
  });

  return {
    getConfig: configCache,

    async setConfig(next) {
      const config = withDefaults(next);
      config.meta = { ...(config.meta || {}), updatedAt: new Date().toISOString() };
      const json = JSON.stringify(config);
      const day = new Date().toISOString().slice(0, 10);
      // Keep a rolling set of daily config snapshots so a bad save can be undone.
      await db.commit([{ set: 'site/config', data: { json } }, { set: `snapshots/config-${day}.json`, data: { json } }]);
      if (prunedOn !== day) {
        prunedOn = day;
        const ids = (await db.listIds('snapshots')).sort();
        await commitAll(ids.slice(0, Math.max(0, ids.length - 14)).map((id) => ({ remove: `snapshots/${id}` })));
      }
      configCache.set(config);
      return config;
    },

    async listSnapshots() {
      return (await db.listIds('snapshots')).filter((id) => /^config-\d{4}-\d{2}-\d{2}\.json$/.test(id)).sort().reverse();
    },

    async readSnapshot(name) {
      if (!/^config-\d{4}-\d{2}-\d{2}\.json$/.test(name)) return null;
      return parse(await db.get(`snapshots/${name}`), null);
    },

    getStats: statsCache,

    async updateStats(fn) {
      statsCache.set(await db.transaction(async (t) => {
        const stats = readStats(await t.get('site/stats'));
        fn(stats);
        t.set('site/stats', { json: JSON.stringify(stats) });
        return stats;
      }));
    },

    // A new salt makes every stored visitor id unreachable, so nobody needs deleting.
    async resetStats() {
      const stats = emptyStats();
      await db.commit([{ set: 'site/stats', data: { json: JSON.stringify(stats) } }]);
      statsCache.set(readStats(null));
    },

    // Runs one page view as a transaction: visitor records are separate documents
    // ({ day, at }) so the stats document doesn't grow with every new visitor.
    async visit(fn) {
      return db.transaction(async (t) => {
        const stats = readStats(await t.get('site/stats'));
        const writes = [];
        const result = await fn({
          stats,
          getVisitor: (id) => t.get(`visitors/${id}`),
          setVisitor(id, rec) { writes.push([id, rec]); },
        });
        if (result.counted) {
          t.set('site/stats', { json: JSON.stringify(stats) });
          for (const [id, rec] of writes) t.set(`visitors/${id}`, rec);
        }
        return { ...result, stats };
      }).then((out) => {
        statsCache.set(out.stats);
        return out;
      });
    },

    getLogin: (key) => db.get(loginPath(key)),
    async setLogin(key, rec) {
      await db.commit([rec ? { set: loginPath(key), data: rec } : { remove: loginPath(key) }]);
    },

    // ---------- media ----------
    // Each part is written with a note in uploading/{name}, so finishing only reads that note.
    async writePart(name, index, buf) {
      const ops = [];
      for (let off = 0, i = index * CHUNKS_PER_PART; off < buf.length; off += CHUNK_SIZE, i++) {
        ops.push({ set: chunkPath(name, i), data: { data: buf.subarray(off, off + CHUNK_SIZE) } });
      }
      ops.push({ set: `uploading/${name}`, data: { [`p${index}`]: true }, merge: true });
      await db.commit(ops);
    },

    async finishFile(name, { label, size }) {
      const parts = Math.ceil(size / PART_SIZE);
      const got = await db.get(`uploading/${name}`);
      if (!parts || !got || Array.from({ length: parts }, (_, i) => got[`p${i}`]).some((p) => !p)) {
        await this.abortFile(name);
        throw new Error('Upload was incomplete, try again.');
      }
      const mtime = Date.now();
      await db.commit([{ set: `files/${name}`, data: { label, size, mtime } }, { remove: `uploading/${name}` }]);
      return fileInfo({ name, size, mtime, label });
    },

    async abortFile(name) {
      const got = await db.get(`uploading/${name}`);
      const parts = got ? Math.max(...Object.keys(got).map((k) => Number(k.slice(1)))) + 1 : 0;
      await removeChunks(name, parts * CHUNKS_PER_PART, [`uploading/${name}`]);
    },

    async listFiles() {
      return (await db.list('files', { orderBy: 'mtime' })).map(({ id, data }) => fileInfo({ name: id, ...data }));
    },

    async removeFile(name) {
      if (!validName(name)) return;
      const meta = await db.get(`files/${name}`);
      if (meta) await removeChunks(name, Math.ceil(meta.size / CHUNK_SIZE), [`files/${name}`]);
    },

    async serveUploads(req, res, next) {
      try {
        const name = decodeURIComponent(req.path.slice(1));
        if (!validName(name) || !['GET', 'HEAD'].includes(req.method)) return next();
        const meta = await db.get(`files/${name}`);
        if (!meta) return next();
        const { size } = meta;
        const etag = `"${name}"`;
        res.set({
          'Content-Type': typeOf(name),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000, immutable',
          // Lets Vercel's CDN keep a copy of whole files, so repeat visits don't read Firestore again.
          // Partial responses (audio/video seeking) are left out so one is never served as the whole file.
          'CDN-Cache-Control': 'public, max-age=31536000, immutable',
          ETag: etag,
        });
        if (req.get('if-none-match') === etag) return res.status(304).end();

        let start = 0;
        let end = size - 1;
        const range = /^bytes=(\d*)-(\d*)$/.exec(req.get('range') || '');
        if (range && (range[1] || range[2])) {
          if (range[1] === '') start = Math.max(0, size - Number(range[2]));
          else {
            start = Number(range[1]);
            if (range[2]) end = Math.min(end, Number(range[2]));
          }
          if (start >= size || start > end) {
            res.set('Content-Range', `bytes */${size}`);
            return res.status(416).end();
          }
          end = Math.min(end, start + MAX_RANGE - 1);
          res.status(206).set({ 'Content-Range': `bytes ${start}-${end}/${size}`, 'CDN-Cache-Control': 'no-store' });
        }
        res.set('Content-Length', String(end - start + 1));
        if (req.method === 'HEAD') return res.end();

        const first = Math.floor(start / CHUNK_SIZE);
        const last = Math.floor(end / CHUNK_SIZE);
        for (let i = first; i <= last && !res.destroyed; i++) {
          const data = (await db.get(chunkPath(name, i)))?.data;
          if (!data) throw new Error(`missing chunk ${i} of ${name}`);
          const from = i === first ? start - i * CHUNK_SIZE : 0;
          const to = i === last ? end - i * CHUNK_SIZE + 1 : data.length;
          if (!res.write(data.subarray(from, to))) await drained(res);
        }
        res.end();
      } catch (err) {
        if (res.headersSent) res.destroy(err);
        else next(err);
      }
    },

    // Random key material for signing logins and form tokens. Created once, in a transaction
    // so two servers can't each make their own.
    async serverSecret() {
      secretCache ||= randomOnce('site/secret', 'key', 32);
      return secretCache.catch((err) => { secretCache = null; throw err; });
    },

    // ---------- comments ----------
    async commentSalt() {
      saltCache ||= randomOnce('site/comments', 'salt', 16);
      return saltCache.catch((err) => { saltCache = null; throw err; });
    },

    async hasCommented(ipHash) { return Boolean(await db.get(`commentIps/${ipHash}`)); },

    // Saves the comment unless this IP already has one (kept after the comment is deleted, so
    // its author can't simply post again); returns whether it was saved.
    addComment(comment, ipHash) {
      const { id, ...data } = comment;
      return db.transaction(async (t) => {
        if (await t.get(`commentIps/${ipHash}`)) return false;
        t.set(`commentIps/${ipHash}`, { at: comment.at, id });
        t.set(`comments/${id}`, data);
        return true;
      });
    },

    async listComments({ limit, before }) {
      const rows = await db.list('comments', { orderBy: 'at', limit: limit + 1, before });
      return { comments: rows.slice(0, limit).map(({ id, data }) => ({ id, ...data })), more: rows.length > limit };
    },

    async removeComment(id) {
      const data = await db.get(`comments/${id}`);
      if (!data) return null;
      await db.commit([{ remove: `comments/${id}` }]);
      return { id, ...data };
    },

    async putAvatar(name, buf) {
      const count = Math.ceil(buf.length / CHUNK_SIZE);
      await db.commit([
        { set: `avatars/${name}`, data: { size: buf.length } },
        ...Array.from({ length: count }, (_, i) => ({ set: `avatars/${name}/chunks/${i}`, data: { data: buf.subarray(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE) } })),
      ]);
    },

    async getAvatar(name) {
      const meta = await db.get(`avatars/${name}`);
      if (!meta) return null;
      const parts = await Promise.all(Array.from({ length: Math.ceil(meta.size / CHUNK_SIZE) }, (_, i) => db.get(`avatars/${name}/chunks/${i}`)));
      return parts.every(Boolean) ? Buffer.concat(parts.map((p) => p.data)) : null;
    },

    async removeAvatar(name) {
      const meta = await db.get(`avatars/${name}`);
      if (!meta) return;
      await commitAll([
        ...Array.from({ length: Math.ceil(meta.size / CHUNK_SIZE) }, (_, i) => ({ remove: `avatars/${name}/chunks/${i}` })),
        { remove: `avatars/${name}` },
      ]);
    },

    // Fixed-window counter shared by every server: at most `max` hits per `windowMs`.
    async hit(bucket, key, windowMs, max) {
      const path = `limits/${bucket}-${crypto.createHash('sha256').update(key).digest('hex').slice(0, 32)}`;
      return db.transaction(async (t) => {
        const now = Date.now();
        let rec = await t.get(path);
        if (!rec || now - rec.start >= windowMs) rec = { start: now, n: 0 };
        rec = { start: rec.start, n: rec.n + 1 };
        t.set(path, rec);
        return { ok: rec.n <= max, retryIn: Math.ceil((rec.start + windowMs - now) / 1000) };
      });
    },

    // Firebase problems that need a fix in the Firebase console, explained instead of "Server error".
    describeError(err) {
      if (err.firebaseSignIn) {
        if (/OPERATION_NOT_ALLOWED|PASSWORD_LOGIN_DISABLED/.test(err.firebaseSignIn)) return 'Firebase sign-in is off. In the Firebase console open Authentication → Sign-in method and enable Email/Password.';
        if (/API_KEY|API key/i.test(err.firebaseSignIn)) return 'Firebase rejected the apiKey in GOOGLEFIREBASECONFIG. Copy the web app config again from Project settings → General.';
        return `Firebase sign-in failed (${err.firebaseSignIn}). Check that FIREBASE_EMAIL and FIREBASE_PASSWORD match the user in Authentication → Users.`;
      }
      const status = err.firestoreStatus || ADMIN_CODES[err.code];
      if (status === 'NOT_FOUND') return 'Firebase has no Firestore database yet. In the Firebase console open Firestore Database → Create database, then reload.';
      if (status === 'RESOURCE_EXHAUSTED') return 'Firestore\'s free daily quota is used up. It resets at midnight Pacific time.';
      if (status === 'PERMISSION_DENIED' && db.uid) return `Firestore's rules blocked the server. In Firestore Database → Rules, paste the rules from the README with this user ID: ${db.uid}`;
      if (status === 'PERMISSION_DENIED' || status === 'UNAUTHENTICATED') return `Firebase refused the service account key in GOOGLEFIREBASECONFIG: ${err.details || err.message}`;
      return null;
    },
  };
}
