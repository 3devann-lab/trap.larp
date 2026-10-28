// Firebase Firestore storage, for Vercel (its servers can't keep files between requests).
// Everything lives in Firestore, uploads included (split into 960 KB chunks), so a free
// Spark-plan project is enough. Settings and stats are stored as JSON strings, which keeps
// them clear of Firestore's rules about nested arrays and field names.
import crypto from 'node:crypto';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { FIREBASE_CONFIG } from '../env.js';
import { withDefaults } from '../../shared/schema.js';
import { CHUNK_SIZE, PART_SIZE, fileInfo, typeOf, validName } from '../media.js';

// Responses to ranged requests (audio/video seeking) stop at 4 MB to stay under Vercel's
// response limit; browsers ask for the rest as they need it.
const MAX_RANGE = 4 * 1024 * 1024;

function credentials() {
  const raw = FIREBASE_CONFIG.trim();
  if (!raw) throw new Error('USEVERCEL is on but GOOGLEFIREBASECONFIG is missing. Paste your Firebase service account key into it (see "Deploy on Vercel" in the README), then redeploy.');
  let key;
  try {
    key = JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
  } catch {
    throw new Error('GOOGLEFIREBASECONFIG isn\'t valid JSON. Paste the whole service account .json file, from the first { to the last }.');
  }
  if (key.apiKey && !key.private_key) {
    throw new Error('GOOGLEFIREBASECONFIG holds the web app config (apiKey, authDomain...), but the server needs a service account key: Firebase console → Project settings → Service accounts → Generate new private key.');
  }
  if (!key.project_id || !key.client_email || !key.private_key) {
    throw new Error('GOOGLEFIREBASECONFIG is missing project_id, client_email or private_key. Paste the whole service account .json file.');
  }
  return key;
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

export function createStore() {
  const key = credentials();
  const app = initializeApp({ credential: cert(key), projectId: key.project_id }, 'trap');
  const db = getFirestore(app);

  const site = db.collection('site');
  const configRef = site.doc('config');
  const statsRef = site.doc('stats');
  const snapshots = db.collection('snapshots');
  const visitors = db.collection('visitors');
  const logins = db.collection('logins');
  const files = db.collection('files');
  const chunkRef = (name, i) => files.doc(name).collection('chunks').doc(String(i));

  const parse = (snap, fallback) => (snap.exists ? JSON.parse(snap.get('json')) : fallback);
  const emptyStats = () => ({ total: 0, unique: 0, daily: {}, referrers: {}, clicks: {}, devices: {}, browsers: {}, countries: {}, recent: [] });
  const readStats = (snap) => ({ ...emptyStats(), ...parse(snap, {}) });
  const loginRef = (key) => logins.doc(crypto.createHash('sha256').update(key).digest('hex').slice(0, 32));

  let prunedOn = '';

  return {
    async getConfig() {
      return withDefaults(parse(await configRef.get(), {}));
    },

    async setConfig(next) {
      const config = withDefaults(next);
      config.meta = { ...(config.meta || {}), updatedAt: new Date().toISOString() };
      const json = JSON.stringify(config);
      const day = new Date().toISOString().slice(0, 10);
      const batch = db.batch();
      batch.set(configRef, { json });
      // Keep a rolling set of daily config snapshots so a bad save can be undone.
      batch.set(snapshots.doc(`config-${day}.json`), { json });
      await batch.commit();
      if (prunedOn !== day) {
        prunedOn = day;
        const refs = (await snapshots.listDocuments()).sort((a, b) => a.id.localeCompare(b.id));
        await Promise.all(refs.slice(0, Math.max(0, refs.length - 14)).map((r) => r.delete()));
      }
      return config;
    },

    async listSnapshots() {
      return (await snapshots.listDocuments()).map((r) => r.id).filter((id) => /^config-\d{4}-\d{2}-\d{2}\.json$/.test(id)).sort().reverse();
    },

    async readSnapshot(name) {
      if (!/^config-\d{4}-\d{2}-\d{2}\.json$/.test(name)) return null;
      return parse(await snapshots.doc(name).get(), null);
    },

    async getStats() {
      return readStats(await statsRef.get());
    },

    async updateStats(fn) {
      await db.runTransaction(async (t) => {
        const stats = readStats(await t.get(statsRef));
        fn(stats);
        t.set(statsRef, { json: JSON.stringify(stats) });
      });
    },

    // A new salt makes every stored visitor id unreachable, so nobody needs deleting.
    async resetStats() {
      await statsRef.set({ json: JSON.stringify(emptyStats()) });
    },

    // Runs one page view as a transaction: visitor records are separate documents
    // ({ day, at }) so the stats document doesn't grow with every new visitor.
    async visit(fn) {
      return db.runTransaction(async (t) => {
        const stats = readStats(await t.get(statsRef));
        const writes = [];
        const result = await fn({
          stats,
          async getVisitor(id) {
            const snap = await t.get(visitors.doc(id));
            return snap.exists ? snap.data() : null;
          },
          setVisitor(id, rec) { writes.push([id, rec]); },
        });
        if (result.counted) {
          t.set(statsRef, { json: JSON.stringify(stats) });
          for (const [id, rec] of writes) t.set(visitors.doc(id), rec);
        }
        return { ...result, stats };
      });
    },

    async getLogin(key) {
      const snap = await loginRef(key).get();
      return snap.exists ? snap.data() : null;
    },
    async setLogin(key, rec) {
      if (rec) await loginRef(key).set(rec);
      else await loginRef(key).delete();
    },

    // ---------- media ----------
    async writePart(name, index, buf) {
      const batch = db.batch();
      for (let off = 0, i = index * (PART_SIZE / CHUNK_SIZE); off < buf.length; off += CHUNK_SIZE, i++) {
        batch.set(chunkRef(name, i), { data: buf.subarray(off, off + CHUNK_SIZE) });
      }
      await batch.commit();
    },

    async finishFile(name, { label, size }) {
      const count = Math.ceil(size / CHUNK_SIZE);
      const refs = Array.from({ length: count }, (_, i) => chunkRef(name, i));
      const got = count ? await db.getAll(...refs, { fieldMask: [] }) : [];
      if (!count || got.some((s) => !s.exists)) {
        await db.recursiveDelete(files.doc(name));
        throw new Error('Upload was incomplete, try again.');
      }
      const mtime = Date.now();
      await files.doc(name).set({ label, size, mtime });
      return fileInfo({ name, size, mtime, label });
    },

    async abortFile(name) {
      await db.recursiveDelete(files.doc(name));
    },

    async listFiles() {
      const snap = await files.orderBy('mtime', 'desc').get();
      return snap.docs.map((d) => fileInfo({ name: d.id, ...d.data() }));
    },

    async removeFile(name) {
      if (validName(name)) await db.recursiveDelete(files.doc(name));
    },

    async serveUploads(req, res, next) {
      try {
        const name = decodeURIComponent(req.path.slice(1));
        if (!validName(name) || !['GET', 'HEAD'].includes(req.method)) return next();
        const snap = await files.doc(name).get();
        if (!snap.exists) return next();
        const { size } = snap.data();
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
          const data = (await chunkRef(name, i).get()).get('data');
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
  };
}
