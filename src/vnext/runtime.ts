import { useSyncExternalStore } from 'react';
import { createBuiltinAdapters } from '@flowstate/adapters';
import { IndexedDBStorage, MemoryStorage, RuntimeHost, type RuntimeSnapshot } from '@flowstate/runtime';

let hostInstance: RuntimeHost | null = null;
let startPromise: Promise<void> | null = null;

/**
 * Singleton headless RuntimeHost — instantiated OUTSIDE React so sensor
 * adapters, IndexedDB, and checkpoint timers never tear down on navigation.
 */
export function getRuntimeHost(): RuntimeHost {
  if (!hostInstance) {
    const hasIdb = typeof indexedDB !== 'undefined';
    const storage = hasIdb ? new IndexedDBStorage() : new MemoryStorage();
    const legacyJson = typeof localStorage !== 'undefined' ? localStorage.getItem('flow-state-v2') : null;
    hostInstance = new RuntimeHost({
      storage,
      adapters: createBuiltinAdapters(),
      legacyLocalStorageJson: legacyJson,
    });
  }
  if (!startPromise) {
    startPromise = hostInstance.start();
  }
  return hostInstance;
}

/** Thin Layer-4 React subscription over the headless RuntimeHost. */
export function useRuntime(): { host: RuntimeHost; state: RuntimeSnapshot } {
  const host = getRuntimeHost();
  const state = useSyncExternalStore(host.subscribe, host.getSnapshot, host.getSnapshot);
  return { host, state };
}
