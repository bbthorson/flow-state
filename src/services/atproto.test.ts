import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Agent } from '@atproto/api';
import { listPublishedFlows } from './atproto';

const goodRecord = (name: string) => ({
  name,
  enabled: true,
  trigger: { type: 'NATIVE_BATTERY', details: { level: 0.2, charging: false } },
  actions: [{ type: 'NOTIFICATION', details: { title: 'Battery low' } }],
});

/** Minimal stand-in for the bits of Agent that listPublishedFlows touches. */
function agentReturning(records: Array<{ uri: string; value: unknown }>): Agent {
  return {
    com: { atproto: { repo: { listRecords: vi.fn().mockResolvedValue({ data: { records } }) } } },
  } as unknown as Agent;
}

describe('listPublishedFlows', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it('returns well-formed flows', async () => {
    const agent = agentReturning([
      { uri: 'at://did:plc:abc/app.flowstate.flow/rk1', value: goodRecord('First') },
    ]);

    const flows = await listPublishedFlows(agent, 'did:plc:abc');

    expect(flows).toHaveLength(1);
    expect(flows[0]).toMatchObject({ name: 'First', did: 'did:plc:abc', rkey: 'rk1' });
  });

  it('skips a malformed record without losing the good ones', async () => {
    // The whole point: someone you follow publishing one broken record used to
    // take out the entire Discover surface.
    const agent = agentReturning([
      { uri: 'at://did:plc:abc/app.flowstate.flow/rk1', value: goodRecord('Keeper') },
      { uri: 'at://did:plc:abc/app.flowstate.flow/rk2', value: { name: 'Broken' } },
      { uri: 'at://did:plc:abc/app.flowstate.flow/rk3', value: null },
      { uri: 'at://did:plc:abc/app.flowstate.flow/rk4', value: goodRecord('Other keeper') },
    ]);

    const flows = await listPublishedFlows(agent, 'did:plc:abc');

    expect(flows.map((f) => f.name)).toEqual(['Keeper', 'Other keeper']);
  });

  it('every returned flow is safe for the UI to render', async () => {
    // FlowCard does triggerType.replace(...) and actions.map(...); NetworkFlowCard
    // reads flow.trigger.type. All of those threw on a malformed record.
    const agent = agentReturning([
      { uri: 'at://did:plc:abc/app.flowstate.flow/rk1', value: { name: 'no trigger', enabled: true, actions: [] } },
      { uri: 'at://did:plc:abc/app.flowstate.flow/rk2', value: goodRecord('Fine') },
    ]);

    const flows = await listPublishedFlows(agent, 'did:plc:abc');

    for (const flow of flows) {
      expect(() => flow.trigger.type.replace(/_/g, ' ')).not.toThrow();
      expect(() => flow.actions.map((a) => a.type)).not.toThrow();
      expect(flow.actions.length).toBeGreaterThan(0);
    }
  });

  it('says which record it skipped and why', async () => {
    const agent = agentReturning([
      { uri: 'at://did:plc:abc/app.flowstate.flow/rk2', value: { name: 'Broken' } },
    ]);

    await listPublishedFlows(agent, 'did:plc:abc');

    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0][0])).toContain('rk2');
  });
});
