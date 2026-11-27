import {
  createPersonalContext,
  migrateLegacyBlock,
  migrateLegacyFlow,
  type Block,
  type Checkpoint,
  type Context,
  type Event,
  type Flow,
  type LegacyFlowLike,
  type RunTrace,
} from '@flowstate/core';

export const STORE_NAMES = [
  'contexts',
  'flows',
  'blocks',
  'secrets',
  'triggerState',
  'checkpoints',
  'runs',
  'events',
  'meta',
] as const;

export type StoreName = (typeof STORE_NAMES)[number];

/**
 * Storage contract shared by Browser IndexedDB, Service Worker IndexedDB,
 * MemoryStorage (tests), and Cloudflare Durable Object storage adapters.
 */
export interface RuntimeStorage {
  getAll<T>(store: StoreName): Promise<T[]>;
  get<T>(store: StoreName, key: string): Promise<T | undefined>;
  put<T>(store: StoreName, key: string, value: T): Promise<void>;
  delete(store: StoreName, key: string): Promise<void>;
  clear(store: StoreName): Promise<void>;
}

// ── Memory Storage (Tests / Ephemeral) ──

export class MemoryStorage implements RuntimeStorage {
  private stores = new Map<StoreName, Map<string, unknown>>();

  constructor() {
    for (const name of STORE_NAMES) {
      this.stores.set(name, new Map());
    }
  }

  private bucket(store: StoreName): Map<string, unknown> {
    let b = this.stores.get(store);
    if (!b) {
      b = new Map();
      this.stores.set(store, b);
    }
    return b;
  }

  async getAll<T>(store: StoreName): Promise<T[]> {
    return [...this.bucket(store).values()].map((v) => structuredClone(v) as T);
  }

  async get<T>(store: StoreName, key: string): Promise<T | undefined> {
    const v = this.bucket(store).get(key);
    return v === undefined ? undefined : (structuredClone(v) as T);
  }

  async put<T>(store: StoreName, key: string, value: T): Promise<void> {
    this.bucket(store).set(key, structuredClone(value));
  }

  async delete(store: StoreName, key: string): Promise<void> {
    this.bucket(store).delete(key);
  }

  async clear(store: StoreName): Promise<void> {
    this.bucket(store).clear();
  }
}

// ── IndexedDB Storage (Browser + Service Worker) ──

const IDB_NAME = 'flow-state-vnext';
const IDB_VERSION = 1;

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

export class IndexedDBStorage implements RuntimeStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private dbName: string;

  constructor(dbName = IDB_NAME) {
    this.dbName = dbName;
  }

  private open(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(this.dbName, IDB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          for (const name of STORE_NAMES) {
            if (!db.objectStoreNames.contains(name)) {
              db.createObjectStore(name);
            }
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
      });
    }
    return this.dbPromise;
  }

  async getAll<T>(store: StoreName): Promise<T[]> {
    const db = await this.open();
    const tx = db.transaction(store, 'readonly');
    return reqToPromise(tx.objectStore(store).getAll() as IDBRequest<T[]>);
  }

  async get<T>(store: StoreName, key: string): Promise<T | undefined> {
    const db = await this.open();
    const tx = db.transaction(store, 'readonly');
    return reqToPromise(tx.objectStore(store).get(key) as IDBRequest<T | undefined>);
  }

  async put<T>(store: StoreName, key: string, value: T): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(store, 'readwrite');
    await reqToPromise(tx.objectStore(store).put(value, key));
  }

  async delete(store: StoreName, key: string): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(store, 'readwrite');
    await reqToPromise(tx.objectStore(store).delete(key));
  }

  async clear(store: StoreName): Promise<void> {
    const db = await this.open();
    const tx = db.transaction(store, 'readwrite');
    await reqToPromise(tx.objectStore(store).clear());
  }
}

// ── Legacy localStorage (`flow-state-v2`) Migration ──

export interface MigrationSummary {
  migratedFlows: number;
  migratedBlocks: number;
  migratedSecrets: number;
}

/**
 * Idempotent one-time migration from legacy Zustand localStorage (`flow-state-v2`)
 * into RuntimeStorage. Leaves `localStorage` untouched as a read-only safety net.
 */
export async function migrateLegacyLocalStorage(
  storage: RuntimeStorage,
  rawJson: string | null,
): Promise<MigrationSummary> {
  const alreadyMigrated = await storage.get<boolean>('meta', 'legacyMigrated');
  if (alreadyMigrated || !rawJson) {
    return { migratedFlows: 0, migratedBlocks: 0, migratedSecrets: 0 };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { migratedFlows: 0, migratedBlocks: 0, migratedSecrets: 0 };
  }

  const state = parsed?.state ?? parsed;
  const personal = (await storage.get<Context>('contexts', 'personal')) ?? createPersonalContext();
  await storage.put('contexts', personal.id, personal);

  let migratedFlows = 0;
  let migratedBlocks = 0;
  let migratedSecrets = 0;

  if (Array.isArray(state?.flows)) {
    for (const rawFlow of state.flows as (LegacyFlowLike & { secrets?: Record<string, string> })[]) {
      if (!rawFlow?.id) continue;
      const flow: Flow = migrateLegacyFlow(rawFlow, 'personal');
      await storage.put('flows', flow.id, flow);
      migratedFlows += 1;

      if (rawFlow.secrets && typeof rawFlow.secrets === 'object') {
        for (const [k, v] of Object.entries(rawFlow.secrets)) {
          if (typeof v === 'string' && v.length > 0) {
            await storage.put('secrets', `${flow.id}:${k}`, v);
            migratedSecrets += 1;
          }
        }
      }
    }
  }

  if (Array.isArray(state?.blocks)) {
    for (const rawBlock of state.blocks) {
      if (!rawBlock?.id) continue;
      const block: Block = migrateLegacyBlock(rawBlock);
      await storage.put('blocks', block.id, block);
      migratedBlocks += 1;
    }
  }

  if (typeof state?.lastBackupTimestamp === 'number') {
    await storage.put('meta', 'lastBackupTimestamp', state.lastBackupTimestamp);
  }

  await storage.put('meta', 'legacyMigrated', true);
  return { migratedFlows, migratedBlocks, migratedSecrets };
}

export type PersistedTriggerState = {
  lastEvent?: Event;
  extra?: Record<string, unknown>;
};

export interface VaultExportPayload {
  version: 3;
  exportedAt: string;
  contexts: Context[];
  flows: Flow[];
  blocks: Block[];
  runs?: RunTrace[];
  checkpoints?: Checkpoint[];
}
