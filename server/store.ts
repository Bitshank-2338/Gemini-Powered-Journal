import { adminDb } from "./firebaseAdmin";
export interface Store {
  get(path: string): Promise<any | null>;
  list(path: string): Promise<any[]>;
  set(path: string, value: any): Promise<void>;
  remove(path: string): Promise<void>;
  transact<T>(
    path: string,
    update: (old: any | null) => { value?: any; result: T },
  ): Promise<T>;
}
export const store: Store = {
  async get(path) {
    const d = await adminDb.doc(path).get();
    return d.exists ? d.data() : null;
  },
  async list(path) {
    const d = await adminDb.collection(path).get();
    return d.docs.map((x) => ({ ...x.data(), id: x.id }));
  },
  async set(path, value) {
    await adminDb.doc(path).set(value);
  },
  async remove(path) {
    await adminDb.doc(path).delete();
  },
  async transact(path, update) {
    return adminDb.runTransaction(async (tx) => {
      const ref = adminDb.doc(path);
      const doc = await tx.get(ref);
      const { value, result } = update(doc.exists ? doc.data() : null);
      if (value !== undefined) tx.set(ref, value);
      return result;
    });
  },
};
