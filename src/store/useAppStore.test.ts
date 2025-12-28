import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAppStore } from './useAppStore';
import * as actions from '@/services/actions';

vi.mock('@/services/actions', () => ({
  executeWebhook: vi.fn().mockResolvedValue({ success: true }),
  executeNotification: vi.fn().mockResolvedValue(undefined),
}));

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset the store state before each test
    const store = useAppStore.getState();
    // We can't easily reset a persisted store without reaching into internals
    // but we can clear the flows.
    useAppStore.setState({ flows: [], logs: [] });
    vi.clearAllMocks();
  });

  it('should trigger flow actions when processDeepLink matches', async () => {
    const flow = {
      name: 'Test Flow',
      enabled: true,
      trigger: {
        type: 'DEEP_LINK' as const,
        details: { event: 'test' },
      },
      actions: [
        {
          type: 'WEBHOOK' as const,
          details: { url: 'https://example.com', method: 'POST' },
        },
      ],
    };

    useAppStore.getState().addFlow(flow);
    const addedFlow = useAppStore.getState().flows[0];

    const params = new URLSearchParams('event=test');
    useAppStore.getState().processDeepLink(params);

    // Verify action was called
    expect(actions.executeWebhook).toHaveBeenCalledWith(flow.actions[0].details);
    
    // Verify log was added
    const logs = useAppStore.getState().logs;
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe('success');
    expect(logs[0].flowId).toBe(addedFlow.id);
  });

  it('should not trigger flow actions when processDeepLink secret is wrong', async () => {
    const flow = {
      name: 'Secret Flow',
      enabled: true,
      securityKey: 'correct-secret',
      trigger: {
        type: 'DEEP_LINK' as const,
        details: { event: 'secret' },
      },
      actions: [
        {
          type: 'NOTIFICATION' as const,
          details: { title: 'Secret', body: 'Unlocked' },
        },
      ],
    };

    useAppStore.getState().addFlow(flow);

    const params = new URLSearchParams('event=secret&secret=wrong-secret');
    useAppStore.getState().processDeepLink(params);

    // Verify action was NOT called
    expect(actions.executeNotification).not.toHaveBeenCalled();
    
    // Verify failure log was added
    const logs = useAppStore.getState().logs;
    expect(logs[0].status).toBe('failure');
    expect(logs[0].message).toContain('Invalid security key');
  });

  it('should trigger flow actions when triggerFlows is called', async () => {
    const flow = {
      name: 'Battery Flow',
      enabled: true,
      trigger: {
        type: 'NATIVE_BATTERY' as const,
        details: { charging: true },
      },
      actions: [
        {
          type: 'NOTIFICATION' as const,
          details: { title: 'Charging', body: 'Started' },
        },
      ],
    };

    useAppStore.getState().addFlow(flow);

    useAppStore.getState().triggerFlows('NATIVE_BATTERY', { charging: true });

    // Verify action was called
    expect(actions.executeNotification).toHaveBeenCalledWith('Charging', 'Started');
    
    // Verify log was added
    const logs = useAppStore.getState().logs;
    expect(logs[0].status).toBe('success');
    expect(logs[0].message).toContain('Flow triggered by NATIVE_BATTERY');
  });
});
