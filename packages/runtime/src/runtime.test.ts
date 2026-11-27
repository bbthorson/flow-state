import { describe, expect, it, vi } from 'vite-plus/test';
import type { Event, Flow } from '@flowstate/core';
import { createLogAdapter, createWebhookAdapter, type CapabilityAdapter } from '@flowstate/adapters';
import { MemoryStorage, RuntimeHost } from './index';

function makeFlow(overrides: Partial<Flow> = {}): Flow {
  return {
    id: 'flow-1',
    contextId: 'personal',
    name: 'Test Flow',
    trigger: { eventType: 'device.battery.changed' },
    inputs: [],
    steps: [],
    active: true,
    dryRun: false,
    executionTarget: 'device',
    createdAt: '2026-11-27T16:00:00.000Z',
    ...overrides,
  };
}

describe('@flowstate/runtime — RuntimeHost', () => {
  it('persists edge-trigger state across host restarts', async () => {
    const storage = new MemoryStorage();
    const dispatched: string[] = [];

    const mockLog: CapabilityAdapter = {
      ...createLogAdapter(),
      async execute(cmd) {
        dispatched.push(String(cmd.input.message));
        return { ok: true, message: String(cmd.input.message) };
      },
    };

    const host1 = new RuntimeHost({ storage, adapters: [mockLog], disableTicker: true });
    await host1.start();

    await host1.saveFlow(
      makeFlow({
        id: 'low-bat',
        trigger: {
          eventType: 'device.battery.changed',
          edgeTriggered: true,
          where: [{ field: 'event.payload.level', operator: 'lte', value: '0.2' }],
        },
        steps: [
          {
            kind: 'command',
            id: 's1',
            targetCapability: 'local.log',
            action: 'write',
            input: { message: 'Low battery {{event.payload.level}}' },
          },
        ],
      }),
    );

    await host1.ingestEvent({
      id: 'e1',
      type: 'device.battery.changed',
      source: 'device',
      author: 'device.battery',
      trust: 'trusted',
      hops: 0,
      payload: { level: 0.18 },
      createdAt: '2026-11-27T16:00:00.000Z',
    });
    expect(dispatched).toEqual(['Low battery 0.18']);
    host1.stop();

    // Simulate full browser reload with a brand new RuntimeHost backed by the same storage
    const host2 = new RuntimeHost({ storage, adapters: [mockLog], disableTicker: true });
    await host2.start();

    await host2.ingestEvent({
      id: 'e2',
      type: 'device.battery.changed',
      source: 'device',
      author: 'device.battery',
      trust: 'trusted',
      hops: 0,
      payload: { level: 0.15 },
      createdAt: '2026-11-27T16:01:00.000Z',
    });
    // Should NOT re-fire because previous persisted state was already <= 0.2
    expect(dispatched).toEqual(['Low battery 0.18']);
  });

  it('checkpoints awaitReply commands across restarts and resumes on correlated reply Event', async () => {
    const storage = new MemoryStorage();
    const sentCommands: Array<{ id: string; input: Record<string, unknown> }> = [];
    const logged: string[] = [];

    const mockLinear: CapabilityAdapter = {
      manifest: {
        id: 'did:plc:linear-bridge',
        kind: 'bridge',
        name: 'Linear Bridge',
        did: 'did:plc:linear-bridge',
        emits: [],
        accepts: [{ action: 'createIssue', label: 'Create Issue', inputs: [] }],
        runtimes: ['remote-did'],
        permissions: [],
      },
      async execute(cmd) {
        sentCommands.push({ id: cmd.id, input: cmd.input });
        return { ok: true, message: 'Sent to Space' };
      },
    };

    const mockLog: CapabilityAdapter = {
      ...createLogAdapter(),
      async execute(cmd) {
        logged.push(String(cmd.input.message));
        return { ok: true };
      },
    };

    const host1 = new RuntimeHost({ storage, adapters: [mockLinear, mockLog], disableTicker: true });
    await host1.start();

    await host1.saveFlow(
      makeFlow({
        id: 'create-and-log',
        trigger: { eventType: 'user.manual.invoked' },
        steps: [
          {
            kind: 'command',
            id: 'c1',
            bindAs: 'issue',
            targetCapability: 'did:plc:linear-bridge',
            action: 'createIssue',
            input: { title: '{{inputs.title}}' },
            awaitReply: { timeoutMs: 60_000 },
          },
          {
            kind: 'command',
            id: 'c2',
            targetCapability: 'local.log',
            action: 'write',
            input: { message: 'URL={{issue.url}}' },
          },
        ],
      }),
    );

    const trace = await host1.runFlowManual('create-and-log', { title: 'Ship Phase 2' });
    expect(trace?.status).toBe('paused');
    expect(sentCommands).toHaveLength(1);
    expect(host1.getSnapshot().checkpoints).toHaveLength(1);
    host1.stop();

    // Restart runtime and deliver reply Event from @linear-bridge
    const host2 = new RuntimeHost({ storage, adapters: [mockLinear, mockLog], disableTicker: true });
    await host2.start();

    const reply: Event = {
      id: 'ev-reply-1',
      type: 'linear.issue.created',
      source: 'space',
      author: 'did:plc:linear-bridge',
      replyTo: sentCommands[0]!.id,
      trust: 'untrusted',
      hops: 0,
      payload: { url: 'https://linear.app/FS-99' },
      createdAt: '2026-11-27T16:02:00.000Z',
    };
    await host2.ingestEvent(reply);

    expect(logged).toEqual(['URL=https://linear.app/FS-99']);
    expect(host2.getSnapshot().checkpoints).toHaveLength(0);
  });

  it('resolves Tier-0 secrets only at dispatch time and omits them from Vault export', async () => {
    const storage = new MemoryStorage();
    const fetchMock = vi.fn(async () => new Response('ok', { status: 200 }));
    const host = new RuntimeHost({
      storage,
      adapters: [createWebhookAdapter(fetchMock as unknown as typeof fetch)],
      disableTicker: true,
    });
    await host.start();

    await host.setSecret('apiKey', 'top-secret-123', 'wh-flow');
    await host.saveFlow(
      makeFlow({
        id: 'wh-flow',
        trigger: { eventType: 'user.manual.invoked' },
        steps: [
          {
            kind: 'command',
            id: 'c1',
            targetCapability: 'local.webhook',
            action: 'request',
            sensitiveFields: ['url', 'headers'],
            input: {
              url: 'https://example.com/hook',
              method: 'POST',
              headers: { Authorization: 'Bearer {{secrets.apiKey}}' },
              body: '{"ok":true}',
            },
          },
        ],
      }),
    );

    const trace = await host.runFlowManual('wh-flow');
    expect(trace?.status).toBe('completed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const callInit = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((callInit.headers as Record<string, string>).Authorization).toBe('Bearer top-secret-123');

    const vault = await host.exportVault();
    expect(vault).not.toContain('top-secret-123');
    expect(JSON.stringify(trace)).not.toContain('top-secret-123');
  });

  it('activates linked Context when entering a Day Block and migrates legacy localStorage', async () => {
    const storage = new MemoryStorage();
    let nowMs = new Date(2026, 10, 27, 9, 30, 0).getTime(); // 09:30 local time

    const legacyDump = JSON.stringify({
      state: {
        flows: [
          {
            id: 'legacy-f1',
            name: 'Legacy Alert',
            active: true,
            trigger: { type: 'MANUAL', details: {} },
            steps: [],
            secrets: { webhookKey: 'legacy-secret' },
          },
        ],
        blocks: [
          { id: 'b-focus', title: 'Deep Work', kind: 'focus', startMin: 540, endMin: 660 },
        ],
      },
    });

    const host = new RuntimeHost({
      storage,
      now: () => nowMs,
      legacyLocalStorageJson: legacyDump,
      disableTicker: true,
    });
    await host.start();

    expect(host.getSnapshot().flows.some((f) => f.id === 'legacy-f1')).toBe(true);
    expect(host.getSnapshot().blocks.some((b) => b.id === 'b-focus')).toBe(true);
    expect(await storage.get('secrets', 'legacy-f1:webhookKey')).toBe('legacy-secret');

    // Link block to a new Work context and advance time into it
    await host.saveContext({
      id: 'ctx-work',
      name: 'Work Focus',
      kind: 'context',
      participants: [],
      pinnedFlowIds: [],
      createdAt: new Date(nowMs).toISOString(),
    });
    await host.saveBlock({
      id: 'b-afternoon',
      title: 'Afternoon Focus',
      kind: 'focus',
      startMin: 780, // 13:00
      endMin: 900, // 15:00
      contextId: 'ctx-work',
    });

    nowMs = new Date(2026, 10, 27, 13, 15, 0).getTime();
    await host.tick(nowMs);
    expect(host.getSnapshot().activeBlockId).toBe('b-afternoon');
    expect(host.getSnapshot().activeContextId).toBe('ctx-work');
  });
});
