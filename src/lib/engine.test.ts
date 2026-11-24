import { describe, it, expect, vi } from 'vitest';
import { evaluateAssertion, matchesTrigger, runFlow, type RunHooks } from './engine';
import type { Flow, FlowStep } from '@/types';

const flowWith = (steps: FlowStep[], extra: Partial<Flow> = {}): Flow => ({
  id: 'f1',
  name: 'Test',
  active: true,
  dryRun: false,
  trigger: { type: 'MANUAL', details: {} },
  steps,
  createdAt: '2026-11-24T00:00:00.000Z',
  ...extra,
});

const hooks = () => {
  const h = {
    execute: vi.fn().mockResolvedValue({ success: true }),
    log: vi.fn(),
    schedule: vi.fn(),
    cancelScheduled: vi.fn(),
  };
  return h as typeof h & RunHooks;
};

const ctx = { device: { battery: { level: 0.5, charging: false } }, now: new Date('2026-11-24T14:30:00') };
const notify = (id: string, title = 'hi'): FlowStep => ({ type: 'action', id, action: { type: 'NOTIFICATION', details: { title } } });

describe('matchesTrigger', () => {
  it('fires a battery flow on entering the configured state, not while staying in it', () => {
    const config = { charging: false, level: 0.2 };
    expect(matchesTrigger('NATIVE_BATTERY', config, { charging: false, level: 0.19, previous: { charging: false, level: 0.21 } })).toBe(true);
    expect(matchesTrigger('NATIVE_BATTERY', config, { charging: false, level: 0.18, previous: { charging: false, level: 0.19 } })).toBe(false);
    // Unplugging while already low also enters the state.
    expect(matchesTrigger('NATIVE_BATTERY', config, { charging: false, level: 0.1, previous: { charging: true, level: 0.1 } })).toBe(true);
    expect(matchesTrigger('NATIVE_BATTERY', config, { charging: true, level: 0.1, previous: { charging: false, level: 0.1 } })).toBe(false);
  });

  it('fires an idle flow when the user goes idle (v1 compared the threshold to the state and never fired)', () => {
    expect(matchesTrigger('IDLE', { threshold: 120000, detectScreen: false }, { userState: 'idle', screenState: 'unlocked' })).toBe(true);
    expect(matchesTrigger('IDLE', { threshold: 120000, detectScreen: false }, { userState: 'active', screenState: 'locked' })).toBe(false);
    expect(matchesTrigger('IDLE', { detectScreen: true }, { userState: 'active', screenState: 'locked' })).toBe(true);
  });

  it('ignores the unmatchable network ssid', () => {
    expect(matchesTrigger('NETWORK', { online: true, ssid: 'Home' }, { online: true })).toBe(true);
    expect(matchesTrigger('NETWORK', { online: true }, { online: false })).toBe(false);
  });
});

describe('evaluateAssertion', () => {
  const data = { trigger: { level: 0.15, tags: ['a', 'b'] }, device: { battery: { charging: false } }, name: 'Kitchen' };
  it.each([
    [{ field: 'trigger.level', operator: 'lt', value: '0.2' }, true],
    [{ field: 'trigger.level', operator: 'gte', value: '0.2' }, false],
    [{ field: 'device.battery.charging', operator: 'eq', value: 'false' }, true],
    [{ field: 'trigger.tags', operator: 'contains', value: 'b' }, true],
    [{ field: 'name', operator: 'startsWith', value: 'Kit' }, true],
    [{ field: 'trigger.missing', operator: 'exists' }, false],
    [{ field: 'trigger.missing', operator: 'notExists' }, true],
    [{ field: 'trigger.level', operator: 'gt', value: 'not a number' }, false],
    [{ field: 'name', operator: 'eq', value: '{{name}}' }, true],
  ] as const)('%j → %s', (assertion, expected) => {
    expect(evaluateAssertion(assertion, data)).toBe(expected);
  });
});

describe('runFlow', () => {
  it('runs actions in order with trigger data namespaced', async () => {
    const h = hooks();
    await runFlow(flowWith([notify('a'), notify('b', '{{trigger.level}}')]), { level: 0.1 }, ctx, h);
    expect(h.execute).toHaveBeenCalledTimes(2);
    expect(h.execute.mock.calls[1][1]).toMatchObject({ trigger: { level: 0.1 }, device: ctx.device, time: { hour: 14, minute: 30 } });
  });

  it('stops at a failing gate', async () => {
    const h = hooks();
    const outcome = await runFlow(
      flowWith([notify('a'), { type: 'condition', id: 'c', assertions: [{ field: 'time.hour', operator: 'lt', value: '8' }] }, notify('b')]),
      {},
      ctx,
      h,
    );
    expect(outcome.status).toBe('gated');
    expect(h.execute).toHaveBeenCalledTimes(1);
  });

  it('takes the matching branch and continues after it', async () => {
    const h = hooks();
    await runFlow(
      flowWith([
        {
          type: 'condition',
          id: 'c',
          assertions: [{ field: 'device.battery.charging', value: 'true' }],
          then: [notify('then', 'charging')],
          else: [notify('else', 'not charging')],
        },
        notify('after', 'after'),
      ]),
      {},
      ctx,
      h,
    );
    expect(h.execute.mock.calls.map((c) => c[0].details.title)).toEqual(['not charging', 'after']);
  });

  it('logs instead of executing in dry run', async () => {
    const h = hooks();
    await runFlow(flowWith([notify('a')], { dryRun: true }), {}, ctx, h);
    expect(h.execute).not.toHaveBeenCalled();
    expect(h.log).toHaveBeenCalledWith('success', expect.stringContaining('Dry run'));
  });

  it('resolves secret variables from flow.secrets and trusts them for URLs', async () => {
    const h = hooks();
    await runFlow(
      flowWith(
        [
          { type: 'variable', id: 'v', name: 'hook', kind: 'secret' },
          { type: 'action', id: 'a', action: { type: 'WEBHOOK', details: { url: '{{hook}}' } } },
        ],
        { secrets: { hook: 'https://example.com/h' } },
      ),
      {},
      ctx,
      h,
    );
    const [, data, trusted] = h.execute.mock.calls[0];
    expect(data.hook).toBe('https://example.com/h');
    expect(trusted.has('hook')).toBe(true);
    expect(trusted.has('trigger')).toBe(false);
  });

  it('taints a variable built from trigger data so it cannot launder it into a URL', async () => {
    const h = hooks();
    await runFlow(
      flowWith([
        { type: 'variable', id: 'v', name: 'host', value: '{{trigger.host}}' },
        { type: 'variable', id: 'w', name: 'path', value: '/fixed' },
        notify('a'),
      ]),
      { host: 'evil.test' },
      ctx,
      h,
    );
    const trusted: Set<string> = h.execute.mock.calls[0][2];
    expect(trusted.has('host')).toBe(false);
    expect(trusted.has('path')).toBe(true);
  });

  it('schedules a delayed action with its data and expiry', async () => {
    const h = hooks();
    await runFlow(
      flowWith([
        {
          type: 'action',
          id: 'a',
          action: { type: 'NOTIFICATION', details: { title: 'later' } },
          schedule: {
            identifier: 'nudge-{{trigger.room}}',
            delay: { unit: 'm', value: { kind: 'literal', n: 10 } },
            expireAfter: { unit: 'h', value: { kind: 'literal', n: 1 } },
          },
        },
      ]),
      { room: 'kitchen' },
      ctx,
      h,
    );
    expect(h.execute).not.toHaveBeenCalled();
    const item = h.schedule.mock.calls[0][0];
    expect(item.identifier).toBe('nudge-kitchen');
    expect(item.dueAt).toBe(ctx.now.getTime() + 600_000);
    expect(item.expiresAt).toBe(ctx.now.getTime() + 600_000 + 3_600_000);
    expect(item.data.trigger).toEqual({ room: 'kitchen' });
  });

  it('cancels scheduled work by rendered identifier', async () => {
    const h = hooks();
    await runFlow(flowWith([{ type: 'cancelScheduled', id: 'x', identifier: 'nudge-{{trigger.room}}' }]), { room: 'kitchen' }, ctx, h);
    expect(h.cancelScheduled).toHaveBeenCalledWith('nudge-kitchen');
  });

  it('exposes a named action result to later steps', async () => {
    const h = hooks();
    h.execute.mockResolvedValueOnce({ success: false, message: 'nope' });
    await runFlow(
      flowWith([
        { type: 'action', id: 'a', name: 'ping', action: { type: 'WEBHOOK', details: { url: 'https://x.test' } } },
        { type: 'condition', id: 'c', assertions: [{ field: 'ping.success', value: 'false' }] },
        notify('b', 'ping failed'),
      ]),
      {},
      ctx,
      h,
    );
    expect(h.execute).toHaveBeenCalledTimes(2);
    expect(h.log).toHaveBeenCalledWith('failure', expect.stringContaining('nope'));
  });
});
