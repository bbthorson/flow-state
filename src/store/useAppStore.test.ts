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
    const secret = useAppStore.getState().webhookSecret;
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

    const params = new URLSearchParams(`event=test&secret=${secret}`);
    useAppStore.getState().processDeepLink(params);

    // Verify action was called
    expect(actions.executeWebhook).toHaveBeenCalledWith(flow.actions[0].details, { event: 'test' });
    
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

  it('should verify global webhookSecret in processDeepLink', async () => {
    const secret = useAppStore.getState().webhookSecret;
    const flow = {
      name: 'Global Secret Flow',
      enabled: true,
      trigger: {
        type: 'DEEP_LINK' as const,
        details: { event: 'global_test' },
      },
      actions: [],
    };

    useAppStore.getState().addFlow(flow);

    // 1. Correct secret
    const paramsOk = new URLSearchParams(`event=global_test&secret=${secret}`);
    useAppStore.getState().processDeepLink(paramsOk);
    expect(useAppStore.getState().logs[0].status).toBe('success');

    // 2. Wrong secret
    const paramsWrong = new URLSearchParams(`event=global_test&secret=wrong`);
    useAppStore.getState().processDeepLink(paramsWrong);
    expect(useAppStore.getState().logs[0].status).toBe('failure');
  });

  it('should parse JSON payload in processDeepLink', async () => {
    const secret = useAppStore.getState().webhookSecret;
    // We need to check if the action receives the parsed payload.
    // However, our current triggerFlows just passes 'details' to executeWebhook.
    const flow = {
      name: 'Payload Flow',
      enabled: true,
      trigger: {
        type: 'DEEP_LINK' as const,
        details: { event: 'payload_test' },
      },
      actions: [
        {
          type: 'WEBHOOK' as const,
          details: { url: 'https://example.com', method: 'POST' },
        },
      ],
    };

    useAppStore.getState().addFlow(flow);

    const payload = JSON.stringify({ custom_data: 'value123' });
    const params = new URLSearchParams(`event=payload_test&payload=${encodeURIComponent(payload)}&secret=${secret}`);
    
    // We want to verify that 'custom_data' is available in the execution context,
    // but right now executeWebhook only gets the fixed action.details.
    // Let's at least verify it's parsed and passed to triggerFlows if we update it.
    
    // For now, let's just implement the parsing in useAppStore first.
    useAppStore.getState().processDeepLink(params);

    // Verify action was called with the parsed payload data
    expect(actions.executeWebhook).toHaveBeenCalledWith(
      flow.actions[0].details,
      expect.objectContaining({ event: 'payload_test', custom_data: 'value123' })
    );
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

    // Verify action was called with details
    expect(actions.executeNotification).toHaveBeenCalledWith(
      flow.actions[0].details,
      { charging: true }
    );
    
    // Verify log was added
    const logs = useAppStore.getState().logs;
    expect(logs[0].status).toBe('success');
    expect(logs[0].message).toContain('Flow triggered by NATIVE_BATTERY');
  });
});
