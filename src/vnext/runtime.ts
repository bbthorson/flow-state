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
    startPromise = hostInstance.start().then(async () => {
      // Ingest deep-link query params (e.g., Apple Shortcuts -> Open URL) as an untrusted Event
      if (typeof window !== 'undefined' && window.location.search.length > 1) {
        const params = new URLSearchParams(window.location.search);
        const payload: Record<string, string> = {};
        params.forEach((v, k) => {
          payload[k] = v;
        });
        window.history.replaceState({}, '', window.location.pathname + window.location.hash);
        await hostInstance!.ingestEvent({
          id: `deeplink-${Date.now()}`,
          type: 'system.deeplink.received',
          source: 'deep-link',
          author: 'external.deeplink',
          trust: 'untrusted',
          hops: 0,
          payload,
          createdAt: new Date().toISOString(),
        });
      }
    });
  }
  return hostInstance;
}

/** Thin Layer-4 React subscription over the headless RuntimeHost. */
export function useRuntime(): { host: RuntimeHost; state: RuntimeSnapshot } {
  const host = getRuntimeHost();
  const state = useSyncExternalStore(host.subscribe, host.getSnapshot, host.getSnapshot);
  return { host, state };
}
