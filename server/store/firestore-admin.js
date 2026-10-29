// Firestore access with a service account key, through the official Admin SDK.
// It bypasses security rules, so the database can stay fully locked.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export function adminAdapter(key) {
  const app = initializeApp({ credential: cert(key), projectId: key.project_id }, 'trap');
  const db = getFirestore(app);
  const ref = (path) => db.doc(path);
  const read = (snap) => (snap.exists ? snap.data() : null);

  return {
    async get(path) {
      return read(await ref(path).get());
    },

    async commit(ops) {
      const batch = db.batch();
      for (const op of ops) {
        if (op.remove) batch.delete(ref(op.remove));
        else batch.set(ref(op.set), op.data, { merge: Boolean(op.merge) });
      }
      await batch.commit();
    },

    transaction(fn) {
      return db.runTransaction((t) => fn({
        get: async (path) => read(await t.get(ref(path))),
        set: (path, data) => t.set(ref(path), data),
      }));
    },

    async list(collection, { orderBy } = {}) {
      let query = db.collection(collection);
      if (orderBy) query = query.orderBy(orderBy, 'desc');
      return (await query.get()).docs.map((d) => ({ id: d.id, data: d.data() }));
    },

    async listIds(collection) {
      return (await db.collection(collection).listDocuments()).map((r) => r.id);
    },
  };
}
