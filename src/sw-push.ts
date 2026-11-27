import { formatScalar, parseEvent, type Command, type RunTrace } from '@flowstate/core';
import {
  createLocalEventAdapter,
  createLogAdapter,
  createWebhookAdapter,
  type CapabilityAdapter,
} from '@flowstate/adapters';
import { RuntimeHost, type RuntimeStorage } from '@flowstate/runtime';

export interface SwPushEnv {
  storage: RuntimeStorage;
  showNotification: (title: string, options?: NotificationOptions) => Promise<void>;
  fetchImpl?: typeof fetch;
}

/**
 * Execute an incoming Web Push event inside the Service Worker.
 *
 * Uses the exact same `@flowstate/runtime` (`RuntimeHost` + `IndexedDBStorage`)
 * and `@flowstate/core` engine as the foreground PWA, armed with SW-safe
 * adapters (`local.notification`, `local.webhook`, `local.log`, `local.event`).
 * Any RunTraces, Context Stream cards, or Checkpoints written here appear
 * automatically the next time the user opens the PWA.
 */
export async function handlePushPayload(
  rawPayload: unknown,
  env: SwPushEnv,
): Promise<{ traces: RunTrace[]; notified: boolean }> {
  const parsed = parseEvent(
    rawPayload && typeof rawPayload === 'object'
      ? {
          id: `push-${Date.now()}`,
          source: 'hub',
          author: 'hub.push',
          trust: 'untrusted',
          hops: 0,
          createdAt: new Date().toISOString(),
          ...(rawPayload as Record<string, unknown>),
        }
      : rawPayload,
  );

  if (!parsed.ok) {
    return { traces: [], notified: false };
  }

  let notified = false;
  const swNotificationAdapter: CapabilityAdapter = {
    manifest: {
      id: 'local.notification',
      kind: 'device',
      name: 'Notification',
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
      runtimes: ['service-worker'],
      permissions: ['notifications'],
    },
    async execute(command: Command) {
      const title = formatScalar(command.input.title || 'Flow State');
      const body = formatScalar(command.input.body || '');
      await env.showNotification(title, { body });
      notified = true;
      return { ok: true, message: `SW notified: ${title}` };
    },
  };

  const host = new RuntimeHost({
    storage: env.storage,
    adapters: [
      swNotificationAdapter,
      createWebhookAdapter(env.fetchImpl ?? globalThis.fetch),
      createLocalEventAdapter(),
      createLogAdapter(),
    ],
    disableTicker: true,
  });

  await host.start();
  const traces = await host.ingestEvent(parsed.data);
  host.stop();

  // Android/Chrome requires a visible notification per Web Push wakeup.
  if (!notified && (parsed.data.title || parsed.data.urgency === 'high')) {
    await env.showNotification(parsed.data.title ?? 'Flow State Event', {
      body: parsed.data.body ?? parsed.data.type,
    });
    notified = true;
  }

  return { traces, notified };
}
