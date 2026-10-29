// Firestore access with the web app config plus an email/password user, over Firestore's REST
// API. Everything is set up in the Firebase console (no key file to download); the database's
// security rules let only that user in.
// The *_EMULATOR_HOST variables point at Firebase's local emulators, the same way Google's SDKs do.
const { FIREBASE_AUTH_EMULATOR_HOST: authEmu, FIRESTORE_EMULATOR_HOST: firestoreEmu } = process.env;
const AUTH_URL = authEmu
  ? `http://${authEmu}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword`
  : 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword';
const FIRESTORE_URL = firestoreEmu ? `http://${firestoreEmu}` : 'https://firestore.googleapis.com';

const encode = (v) => {
  if (Buffer.isBuffer(v)) return { bytesValue: v.toString('base64') };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (Number.isInteger(v)) return { integerValue: String(v) };
  if (typeof v === 'number') return { doubleValue: v };
  return { nullValue: null };
};
const decode = (f) => {
  if ('bytesValue' in f) return Buffer.from(f.bytesValue, 'base64');
  if ('integerValue' in f) return Number(f.integerValue);
  if ('doubleValue' in f) return f.doubleValue;
  if ('booleanValue' in f) return f.booleanValue;
  if ('stringValue' in f) return f.stringValue;
  return null;
};
const toFields = (data) => Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined).map(([k, v]) => [k, encode(v)]));
const fromDoc = (doc) => Object.fromEntries(Object.entries(doc.fields || {}).map(([k, f]) => [k, decode(f)]));

export function restAdapter({ apiKey, projectId, email, password }) {
  const root = `projects/${encodeURIComponent(projectId)}/databases/(default)/documents`;
  const base = `${FIRESTORE_URL}/v1/${root}`;
  const docUrl = (path) => `${base}/${path.split('/').map(encodeURIComponent).join('/')}`;
  let token = '';
  let expires = 0;
  let signingIn = null;
  const adapter = { uid: '' };

  // Signs in as the site's Firebase user; ID tokens last an hour, so sign in again before then.
  async function idToken() {
    if (token && Date.now() < expires - 5 * 60e3) return token;
    signingIn ||= (async () => {
      const res = await fetch(`${AUTH_URL}?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(`Firebase sign-in failed: ${body.error?.message || res.status}`), { firebaseSignIn: String(body.error?.message || res.status) });
      token = body.idToken;
      adapter.uid = body.localId;
      expires = Date.now() + Number(body.expiresIn || 3600) * 1000;
      return token;
    })().finally(() => { signingIn = null; });
    return signingIn;
  }

  async function call(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: { authorization: `Bearer ${await idToken()}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body && JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    // A missing document is a 404 too ("Document ... not found"); only a missing database
    // ("The database (default) does not exist ...") is an error.
    if (res.status === 404 && method === 'GET' && !/does not exist/i.test(data.error?.message || '')) return null;
    if (!res.ok) {
      throw Object.assign(new Error(`Firestore: ${data.error?.message || res.status}`), { firestoreStatus: data.error?.status || String(res.status) });
    }
    return data;
  }

  const write = (op) => (op.remove
    ? { delete: `${root}/${op.remove}` }
    : { update: { name: `${root}/${op.set}`, fields: toFields(op.data) }, ...(op.merge ? { updateMask: { fieldPaths: Object.keys(op.data) } } : {}) });

  return Object.assign(adapter, {
    async get(path) {
      const doc = await call('GET', docUrl(path));
      return doc && fromDoc(doc);
    },

    async commit(ops) {
      await call('POST', `${base}:commit`, { writes: ops.map(write) });
    },

    // Retries when Firestore aborts the transaction because of a concurrent change.
    async transaction(fn) {
      for (let attempt = 0; ; attempt++) {
        const { transaction } = await call('POST', `${base}:beginTransaction`, {});
        const writes = [];
        let result;
        try {
          result = await fn({
            // Reads go through batchGet, as Firebase's own SDKs do inside transactions.
            get: async (path) => {
              const [row] = await call('POST', `${base}:batchGet`, { documents: [`${root}/${path}`], transaction });
              return row?.found ? fromDoc(row.found) : null;
            },
            set: (path, data) => writes.push(write({ set: path, data })),
          });
        } catch (err) {
          // Release the transaction's locks instead of leaving them until it times out.
          await call('POST', `${base}:rollback`, { transaction }).catch(() => {});
          throw err;
        }
        try {
          await call('POST', `${base}:commit`, { writes, transaction });
          return result;
        } catch (err) {
          if (err.firestoreStatus !== 'ABORTED' || attempt >= 4) throw err;
        }
      }
    },

    // Newest first by `orderBy`; `before` continues after that value, `limit` caps the page.
    async list(collection, { orderBy, limit, before } = {}) {
      const rows = await call('POST', `${base}:runQuery`, {
        structuredQuery: {
          from: [{ collectionId: collection }],
          ...(orderBy ? { orderBy: [{ field: { fieldPath: orderBy }, direction: 'DESCENDING' }] } : {}),
          ...(orderBy && before !== undefined ? { startAt: { values: [encode(before)], before: false } } : {}),
          ...(limit ? { limit } : {}),
        },
      });
      return rows.filter((r) => r.document).map((r) => ({ id: r.document.name.split('/').pop(), data: fromDoc(r.document) }));
    },

    // Asks for a field no document has, so only the names come back.
    async listIds(collection) {
      const ids = [];
      let page = '';
      do {
        const res = await call('GET', `${docUrl(collection)}?pageSize=300&mask.fieldPaths=_${page ? `&pageToken=${encodeURIComponent(page)}` : ''}`);
        for (const d of res?.documents || []) ids.push(d.name.split('/').pop());
        page = res?.nextPageToken || '';
      } while (page);
      return ids;
    },
  });
}
