import { adminDb } from './firebaseAdmin.js';

/**
 * In-memory test store for controlled security and isolation testing
 */
class MemoryDocRef {
  constructor(private store: Map<string, any>, public path: string) {}

  get id(): string {
    const parts = this.path.split('/');
    return parts[parts.length - 1];
  }

  async get() {
    const data = this.store.get(this.path);
    return {
      exists: data !== undefined,
      id: this.id,
      data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined),
      ref: this,
    };
  }

  async set(data: any, options?: { merge?: boolean }) {
    if (options?.merge && this.store.has(this.path)) {
      const existing = this.store.get(this.path);
      this.store.set(this.path, { ...existing, ...data });
    } else {
      this.store.set(this.path, JSON.parse(JSON.stringify(data)));
    }
  }

  async update(updates: any) {
    if (!this.store.has(this.path)) {
      throw new Error(`Document does not exist at ${this.path}`);
    }
    const existing = this.store.get(this.path);
    this.store.set(this.path, { ...existing, ...updates });
  }

  async delete() {
    this.store.delete(this.path);
  }

  collection(name: string) {
    return new MemoryCollectionRef(this.store, `${this.path}/${name}`);
  }
}

class MemoryCollectionRef {
  constructor(private store: Map<string, any>, public path: string) {}

  doc(id: string) {
    return new MemoryDocRef(this.store, `${this.path}/${id}`);
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
    return {
      get: async () => {
        const docs: any[] = [];
        const prefix = `${this.path}/`;
        for (const [key, value] of this.store.entries()) {
          if (key.startsWith(prefix)) {
            const remainder = key.slice(prefix.length);
            // Must be direct child, not deeper subcollection
            if (!remainder.includes('/')) {
              docs.push({
                id: remainder,
                data: () => JSON.parse(JSON.stringify(value)),
                ref: new MemoryDocRef(this.store, key),
              });
            }
          }
        }

        docs.sort((a, b) => {
          const valA = a.data()[field] || '';
          const valB = b.data()[field] || '';
          if (direction === 'asc') return valA > valB ? 1 : -1;
          return valA < valB ? 1 : -1;
        });

        return {
          empty: docs.length === 0,
          docs,
        };
      },
    };
  }

  where(field: string, op: string, value: any) {
    return {
      get: async () => {
        const docs: any[] = [];
        const prefix = `${this.path}/`;
        for (const [key, docValue] of this.store.entries()) {
          if (key.startsWith(prefix)) {
            const remainder = key.slice(prefix.length);
            if (!remainder.includes('/')) {
              if (op === '==' && docValue[field] === value) {
                docs.push({
                  id: remainder,
                  data: () => JSON.parse(JSON.stringify(docValue)),
                  ref: new MemoryDocRef(this.store, key),
                });
              }
            }
          }
        }
        return {
          empty: docs.length === 0,
          docs,
        };
      },
    };
  }

  async get() {
    return this.orderBy('createdAt', 'asc').get();
  }
}

class MemoryBatch {
  private ops: Array<() => void> = [];

  delete(docRef: any) {
    this.ops.push(() => docRef.delete());
    return this;
  }

  async commit() {
    for (const op of this.ops) {
      await op();
    }
  }
}

class MemoryDb {
  public store = new Map<string, any>();

  collection(name: string) {
    return new MemoryCollectionRef(this.store, name);
  }

  batch() {
    return new MemoryBatch();
  }
}

export const memoryDb = new MemoryDb();

/**
 * Returns database instance based on environment:
 * - Test environment: isolated MemoryDb emulator
 * - Production: Cloud Firestore via Firebase Admin SDK
 */
export function getDb(): any {
  if (process.env.NODE_ENV === 'test') {
    return memoryDb;
  }
  return adminDb;
}
