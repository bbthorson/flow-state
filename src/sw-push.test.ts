import { describe, expect, it, vi } from 'vite-plus/test';
import type { Flow } from '@flowstate/core';
import { MemoryStorage } from '@flowstate/runtime';
import { handlePushPayload } from './sw-push';

describe('Service Worker push executor (src/sw-push.ts)', () => {
  it('reads flows & Tier-0 secrets from storage, executes SW-safe commands, and records RunTraces', async () => {
    const storage = new MemoryStorage();
    const showNotification = vi.fn(async () => {});
    const fetchMock = vi.fn(async () => new Response('ok', { status: 200 }));

    const bgFlow: Flow = {
      id: 'bg-oncall',
      contextId: 'personal',
      name: 'Background On-Call Alert',
      trigger: { eventType: 'deploy.failed' },
      inputs: [],
      steps: [
        {
          kind: 'command',
          id: 's1',
          targetCapability: 'local.notification',
          action: 'show',
          input: { title: 'Deploy Failed', body: '{{event.title}}' },
        },
        {
          kind: 'command',
          id: 's2',
          targetCapability: 'local.webhook',
          action: 'request',
          sensitiveFields: ['url', 'headers'],
          input: {
            url: 'https://hooks.example/ack',
            method: 'POST',
            headers: { Authorization: 'Bearer {{secrets.ackToken}}' },
            body: '{"event":"{{event.type}}"}',
          },
        },
      ],
      active: true,
      dryRun: false,
      executionTarget: 'device',
      createdAt: '2026-11-27T16:00:00.000Z',
    };

    await storage.put('flows', bgFlow.id, bgFlow);
    await storage.put('secrets', 'bg-oncall:ackToken', 'sw-secret-token');

    const res = await handlePushPayload(
      { type: 'deploy.failed', title: 'api-prod #99', urgency: 'high', payload: {} },
      { storage, showNotification, fetchImpl: fetchMock as unknown as typeof fetch },
    );

    expect(res.notified).toBe(true);
    expect(showNotification).toHaveBeenCalledWith('Deploy Failed', { body: 'api-prod #99' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callInit = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((callInit.headers as Record<string, string>).Authorization).toBe('Bearer sw-secret-token');
    expect(res.traces).toHaveLength(1);
    expect(res.traces[0]?.status).toBe('completed');
    // Persisted trace is readable when PWA reopens
    expect(await storage.getAll('runs')).toHaveLength(1);
  });
});
