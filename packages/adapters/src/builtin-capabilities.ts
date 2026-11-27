import { formatScalar, materializeSecrets, type Capability, type Command, type Event } from '@flowstate/core';
import type { AdapterEmitFn, CapabilityAdapter, CommandDispatchResult, SecretResolver } from './types';

function makeId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `ev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function resolveAllSecretsInString(
  raw: string,
  resolveSecret: SecretResolver,
): Promise<{ ok: true; value: string } | { ok: false; missingKeys: string[] }> {
  const keys = [...raw.matchAll(/\{\{\s*secrets\.([^}]+?)\s*\}\}/g)].map((m) => m[1]!.trim());
  const map = new Map<string, string | undefined>();
  for (const k of keys) {
    map.set(k, await resolveSecret(k));
  }
  return materializeSecrets(raw, (k) => map.get(k));
}

// ── Built-in Device Sensor Adapters ──

export function createBatteryAdapter(): CapabilityAdapter {
  let batteryRef: any = null;
  let listener: (() => void) | null = null;
  let snapshot: Record<string, unknown> = { supported: false, level: 1, charging: false };

  const manifest: Capability = {
    id: 'device.battery',
    kind: 'device',
    name: 'Battery',
    description: 'Monitors device battery level and charging state while foregrounded.',
    emits: [
      {
        type: 'device.battery.changed',
        label: 'Battery state changed',
        fields: [
          { name: 'level', label: 'Level (0-1)', type: 'number' },
          { name: 'charging', label: 'Charging', type: 'boolean' },
        ],
      },
    ],
    accepts: [],
    runtimes: ['browser'],
    permissions: [],
  };

  return {
    manifest,
    getSnapshot: () => ({ battery: snapshot }),
    start(emit: AdapterEmitFn) {
      if (typeof navigator === 'undefined' || typeof (navigator as any).getBattery !== 'function') return;
      void (navigator as any).getBattery().then((bat: any) => {
        batteryRef = bat;
        const publish = () => {
          snapshot = { supported: true, level: bat.level, charging: bat.charging };
          emit({
            id: makeId(),
            type: 'device.battery.changed',
            source: 'device',
            author: 'device.battery',
            trust: 'trusted',
            hops: 0,
            payload: { level: bat.level, charging: bat.charging },
            createdAt: new Date().toISOString(),
          });
        };
        snapshot = { supported: true, level: bat.level, charging: bat.charging };
        listener = publish;
        bat.addEventListener('levelchange', publish);
        bat.addEventListener('chargingchange', publish);
      });
    },
    stop() {
      if (batteryRef && listener) {
        batteryRef.removeEventListener('levelchange', listener);
        batteryRef.removeEventListener('chargingchange', listener);
      }
      batteryRef = null;
      listener = null;
    },
  };
}

export function createNetworkAdapter(): CapabilityAdapter {
  let onOnline: (() => void) | null = null;
  let onOffline: (() => void) | null = null;
  let snapshot: Record<string, unknown> = {
    supported: typeof navigator !== 'undefined',
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  };

  const manifest: Capability = {
    id: 'device.network',
    kind: 'device',
    name: 'Network',
    description: 'Detects online/offline connectivity transitions.',
    emits: [
      {
        type: 'device.network.changed',
        label: 'Network connectivity changed',
        fields: [{ name: 'online', label: 'Online', type: 'boolean' }],
      },
    ],
    accepts: [],
    runtimes: ['browser'],
    permissions: [],
  };

  return {
    manifest,
    getSnapshot: () => ({ network: snapshot }),
    start(emit: AdapterEmitFn) {
      if (typeof window === 'undefined') return;
      const fire = (online: boolean) => {
        snapshot = { supported: true, online };
        emit({
          id: makeId(),
          type: 'device.network.changed',
          source: 'device',
          author: 'device.network',
          trust: 'trusted',
          hops: 0,
          payload: { online },
          createdAt: new Date().toISOString(),
        });
      };
      onOnline = () => fire(true);
      onOffline = () => fire(false);
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
    },
    stop() {
      if (typeof window === 'undefined') return;
      if (onOnline) window.removeEventListener('online', onOnline);
      if (onOffline) window.removeEventListener('offline', onOffline);
      onOnline = null;
      onOffline = null;
    },
  };
}

// ── Built-in Local Action Adapters ──

export function createWebhookAdapter(fetchImpl: typeof fetch = globalThis.fetch): CapabilityAdapter {
  const manifest: Capability = {
    id: 'local.webhook',
    kind: 'system',
    name: 'Webhook',
    description: 'Send an HTTP request to an external endpoint (Home Assistant, ntfy, etc.).',
    emits: [],
    accepts: [
      {
        action: 'request',
        label: 'Send HTTP Request',
        inputs: [
          { name: 'url', label: 'URL', type: 'url', required: true, sensitive: true },
          { name: 'method', label: 'Method', type: 'enum', options: ['POST', 'GET', 'PUT'], defaultValue: 'POST' },
          { name: 'body', label: 'Body', type: 'string' },
        ],
      },
    ],
    runtimes: ['browser', 'service-worker', 'hub'],
    permissions: [],
  };

  return {
    manifest,
    async execute(command: Command, resolveSecret: SecretResolver): Promise<CommandDispatchResult> {
      const rawUrl = formatScalar(command.input.url);
      if (!rawUrl) return { ok: false, message: 'Missing webhook URL' };

      const urlRes = await resolveAllSecretsInString(rawUrl, resolveSecret);
      if (!urlRes.ok) return { ok: false, message: `Missing secrets: ${urlRes.missingKeys.join(', ')}` };

      const method = formatScalar(command.input.method || 'POST').toUpperCase();
      const headers: Record<string, string> = {};
      if (command.input.headers && typeof command.input.headers === 'object') {
        for (const [k, v] of Object.entries(command.input.headers as Record<string, unknown>)) {
          const hRes = await resolveAllSecretsInString(formatScalar(v), resolveSecret);
          if (!hRes.ok) return { ok: false, message: `Missing secrets: ${hRes.missingKeys.join(', ')}` };
          headers[k] = hRes.value;
        }
      }

      let body: string | undefined;
      if (method !== 'GET' && command.input.body !== undefined) {
        const bRes = await resolveAllSecretsInString(formatScalar(command.input.body), resolveSecret);
        if (!bRes.ok) return { ok: false, message: `Missing secrets: ${bRes.missingKeys.join(', ')}` };
        body = bRes.value;
        if (!headers['Content-Type'] && !headers['content-type']) {
          headers['Content-Type'] = 'application/json';
        }
      }

      try {
        const res = await fetchImpl(urlRes.value, { method, headers, body });
        return {
          ok: res.ok,
          message: `${method} ${res.status}`,
          output: { status: res.status, ok: res.ok },
        };
      } catch (err) {
        return { ok: false, message: err instanceof Error ? err.message : 'Network error' };
      }
    },
  };
}

export function createNotificationAdapter(): CapabilityAdapter {
  const manifest: Capability = {
    id: 'local.notification',
    kind: 'device',
    name: 'Notification',
    description: 'Display a local browser/OS notification.',
    emits: [],
    accepts: [
      {
        action: 'show',
        label: 'Show Notification',
        inputs: [
          { name: 'title', label: 'Title', type: 'string', required: true },
          { name: 'body', label: 'Body', type: 'string' },
        ],
      },
    ],
    runtimes: ['browser', 'service-worker'],
    permissions: ['notifications'],
  };

  return {
    manifest,
    async execute(command: Command): Promise<CommandDispatchResult> {
      const title = formatScalar(command.input.title || 'Flow State');
      const body = formatScalar(command.input.body || '');

      if (typeof Notification === 'undefined') {
        return { ok: false, message: 'Notifications API not supported' };
      }
      if (Notification.permission !== 'granted') {
        return { ok: false, message: 'Notification permission not granted' };
      }
      new Notification(title, { body });
      return { ok: true, message: `Notified: ${title}` };
    },
  };
}

export function createClipboardAdapter(): CapabilityAdapter {
  const manifest: Capability = {
    id: 'local.clipboard',
    kind: 'device',
    name: 'Clipboard',
    description: 'Copy text to the system clipboard.',
    emits: [],
    accepts: [
      {
        action: 'write',
        label: 'Copy to Clipboard',
        inputs: [{ name: 'text', label: 'Text', type: 'string', required: true }],
      },
    ],
    runtimes: ['browser'],
    permissions: ['clipboard-write'],
  };

  return {
    manifest,
    async execute(command: Command): Promise<CommandDispatchResult> {
      const text = formatScalar(command.input.text ?? '');
      if (typeof navigator === 'undefined' || !navigator.clipboard) {
        return { ok: false, message: 'Clipboard API unavailable' };
      }
      await navigator.clipboard.writeText(text);
      return { ok: true, message: 'Copied to clipboard' };
    },
  };
}

export function createLocalEventAdapter(): CapabilityAdapter {
  const manifest: Capability = {
    id: 'local.event',
    kind: 'system',
    name: 'Event Bus',
    description: 'Emit a typed event locally (or into a Context Space) to trigger other flows.',
    emits: [{ type: '*', label: 'Any Event', fields: [] }],
    accepts: [
      {
        action: 'emit',
        label: 'Emit Event',
        inputs: [
          { name: 'event', label: 'Event Type', type: 'string', required: true },
          { name: 'title', label: 'Title', type: 'string' },
          { name: 'body', label: 'Body', type: 'string' },
        ],
      },
    ],
    runtimes: ['browser', 'service-worker', 'hub'],
    permissions: [],
  };

  return {
    manifest,
    async execute(command: Command, _resolveSecret: SecretResolver, emit: AdapterEmitFn): Promise<CommandDispatchResult> {
      const eventType = formatScalar(command.input.event);
      if (!eventType) return { ok: false, message: 'Missing event type' };
      const ev: Event = {
        id: makeId(),
        type: eventType,
        source: 'local-flow',
        author: 'self',
        ...(command.space ? { space: command.space } : {}),
        trust: 'trusted',
        ...(command.input.title ? { title: formatScalar(command.input.title) } : {}),
        ...(command.input.body ? { body: formatScalar(command.input.body) } : {}),
        hops: typeof command.input.hops === 'number' ? command.input.hops + 1 : 1,
        payload:
          command.input.data && typeof command.input.data === 'object'
            ? (command.input.data as Record<string, unknown>)
            : {},
        createdAt: new Date().toISOString(),
      };
      emit(ev);
      return { ok: true, message: `Emitted "${eventType}"` };
    },
  };
}

export function createLogAdapter(): CapabilityAdapter {
  const manifest: Capability = {
    id: 'local.log',
    kind: 'system',
    name: 'Log',
    description: 'Record a structured message in the Run Trace.',
    emits: [],
    accepts: [
      {
        action: 'write',
        label: 'Write Log',
        inputs: [{ name: 'message', label: 'Message', type: 'string', required: true }],
      },
    ],
    runtimes: ['browser', 'service-worker', 'hub'],
    permissions: [],
  };

  return {
    manifest,
    async execute(command: Command): Promise<CommandDispatchResult> {
      return { ok: true, message: formatScalar(command.input.message || '') };
    },
  };
}

/** Return the standard set of built-in browser adapters. */
export function createBuiltinAdapters(): CapabilityAdapter[] {
  return [
    createBatteryAdapter(),
    createNetworkAdapter(),
    createWebhookAdapter(),
    createNotificationAdapter(),
    createClipboardAdapter(),
    createLocalEventAdapter(),
    createLogAdapter(),
  ];
}
