import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAppStore, MAX_LOGS, writePersisted } from './useAppStore';
import * as actions from '@/services/actions';

// Every executor must be present: the store builds its dispatch table at module
// load, so a missing one is a TypeError rather than a quiet no-op.
vi.mock('@/services/actions', () => ({
  executeWebhook: vi.fn().mockResolvedValue({ success: true }),
  executeNotification: vi.fn().mockResolvedValue({ success: true }),
  executeVibration: vi.fn().mockResolvedValue({ success: true }),
  executeClipboard: vi.fn().mockResolvedValue({ success: true }),
  executeShare: vi.fn().mockResolvedValue({ success: true }),
  executeWakeLock: vi.fn().mockResolvedValue({ success: true }),
  executeSpeech: vi.fn().mockResolvedValue({ success: true }),
}));

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset the store state before each test
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

  it('should add a flow from a template', () => {
    const template = {
      name: 'Template Flow',
      enabled: true,
      trigger: {
        type: 'MANUAL' as const,
        details: {},
      },
      actions: [],
    };

    useAppStore.getState().addFlowFromTemplate(template);
    
    const flows = useAppStore.getState().flows;
    expect(flows).toHaveLength(1);
    expect(flows[0].name).toBe('Template Flow');
    expect(flows[0].id).toBeDefined();
    
    const logs = useAppStore.getState().logs;
    expect(logs).toHaveLength(1);
    expect(logs[0].message).toContain('Installed flow template: Template Flow');
  });
});

describe('log retention', () => {
  beforeEach(() => {
    useAppStore.setState({ flows: [], logs: [] });
  });

  it('caps the history at MAX_LOGS, keeping the newest', () => {
    const { addLog } = useAppStore.getState();
    for (let i = 0; i < MAX_LOGS + 50; i++) {
      addLog({ flowId: 'SYSTEM', status: 'success', message: `entry ${i}` });
    }

    const { logs } = useAppStore.getState();
    expect(logs).toHaveLength(MAX_LOGS);
    // addLog prepends, so the most recent write is first and the oldest are gone.
    expect(logs[0].message).toBe(`entry ${MAX_LOGS + 49}`);
    expect(logs.some((l) => l.message === 'entry 0')).toBe(false);
  });

  it('caps logs coming in from a vault import', () => {
    const logs = Array.from({ length: MAX_LOGS + 100 }, (_, i) => ({
      id: `l${i}`, flowId: 'SYSTEM', timestamp: i, status: 'success' as const, message: `m${i}`,
    }));

    const result = useAppStore.getState().importVault(JSON.stringify({ flows: [], blocks: [], logs }));

    expect(result.success).toBe(true);
    expect(useAppStore.getState().logs).toHaveLength(MAX_LOGS);
  });

  it('filters malformed flows coming in from a vault import', () => {
    const validFlow = {
      id: 'f1',
      name: 'Valid flow',
      enabled: true,
      trigger: { type: 'NATIVE_BATTERY', details: { level: 0.5, charging: true } },
      actions: [{ type: 'NOTIFICATION', details: { title: 'Battery OK' } }],
    };
    const invalidFlow = {
      id: 'f2',
      name: 'Broken flow',
      enabled: true,
      trigger: { type: 'INVALID_TRIGGER_TYPE', details: {} },
      actions: [],
    };

    const result = useAppStore.getState().importVault(JSON.stringify({
      flows: [validFlow, invalidFlow, null, 'not a flow'],
      blocks: [],
      logs: [],
    }));

    expect(result.success).toBe(true);
    const imported = useAppStore.getState().flows;
    expect(imported).toHaveLength(1);
    expect(imported[0].name).toBe('Valid flow');
  });
});

describe('processDeepLink logging', () => {
  beforeEach(() => {
    useAppStore.setState({ flows: [], logs: [] });
  });

  const run = (query: string) => {
    useAppStore.getState().processDeepLink(new URLSearchParams(query));
    return useAppStore.getState().logs;
  };

  it('stays quiet for the app\'s own ?panel=control link', () => {
    expect(run('panel=control')).toHaveLength(0);
  });

  it('stays quiet for unrelated tracking params', () => {
    expect(run('utm_source=twitter&utm_campaign=launch')).toHaveLength(0);
  });

  it('still reports a miss when a secret was supplied', () => {
    const logs = run('event=typo&secret=whatever');

    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe('failure');
    expect(logs[0].message).toContain('No flow found for deep link');
  });

  it('still reports a bad secret against a matching flow', () => {
    useAppStore.setState({
      flows: [{
        id: 'f1', name: 'Deep', enabled: true,
        trigger: { type: 'DEEP_LINK', details: { event: 'go' } },
        actions: [{ type: 'LOG', details: {} }],
      }] as never,
    });

    const logs = run('event=go&secret=wrong');

    expect(logs.some((l) => l.message.includes('Invalid security key'))).toBe(true);
  });
});

describe('writePersisted (quota resilience)', () => {
  const quotaError = () => {
    const err = new Error('QuotaExceededError');
    err.name = 'QuotaExceededError';
    return err;
  };

  it('writes straight through when there is room', () => {
    const setItem = vi.fn();
    writePersisted({ setItem }, 'k', '{"state":{"logs":[1]}}');
    expect(setItem).toHaveBeenCalledExactlyOnceWith('k', '{"state":{"logs":[1]}}');
  });

  it('drops history and retries when the quota is exceeded, keeping flows', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const setItem = vi.fn()
      .mockImplementationOnce(() => { throw quotaError(); })
      .mockImplementationOnce(() => undefined);

    writePersisted({ setItem }, 'k', JSON.stringify({ state: { flows: [{ id: 'f1' }], logs: [{ id: 'l1' }] } }));

    expect(setItem).toHaveBeenCalledTimes(2);
    const retried = JSON.parse(setItem.mock.calls[1][1]);
    expect(retried.state.logs).toEqual([]);
    expect(retried.state.flows).toEqual([{ id: 'f1' }]); // the irreplaceable part survives
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('reports the failure when there is no history left to drop', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const setItem = vi.fn(() => { throw quotaError(); });

    writePersisted({ setItem }, 'k', JSON.stringify({ state: { flows: [], logs: [] } }));

    expect(setItem).toHaveBeenCalledTimes(1); // nothing to retry with
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe('action execution', () => {
  beforeEach(() => {
    useAppStore.setState({ flows: [], logs: [] });
    vi.clearAllMocks();
  });

  const runFlowWith = (action: { type: string; details: Record<string, unknown> }) => {
    useAppStore.getState().addFlow({
      name: 'Test Flow',
      enabled: true,
      trigger: { type: 'MANUAL', details: {} },
      actions: [action],
    } as never);
    const flowId = useAppStore.getState().flows[0].id;
    useAppStore.getState().triggerFlows('MANUAL', {}, flowId);
    return flowId;
  };

  it('runs an action whose details are valid', () => {
    runFlowWith({ type: 'WEBHOOK', details: { url: 'https://example.com' } });

    expect(actions.executeWebhook).toHaveBeenCalledOnce();
  });

  it('skips an action with invalid details instead of calling the executor', () => {
    // A webhook with no url reached executeWebhook as `{} as any` before, and
    // failed somewhere inside fetch with a far less useful message.
    runFlowWith({ type: 'WEBHOOK', details: { method: 'POST' } });

    expect(actions.executeWebhook).not.toHaveBeenCalled();
    const logs = useAppStore.getState().logs;
    expect(logs.some((l) => l.status === 'failure' && /invalid settings/.test(l.message))).toBe(true);
  });

  it('names the offending field when it skips', () => {
    runFlowWith({ type: 'SPEECH', details: {} });

    const failure = useAppStore.getState().logs.find((l) => l.status === 'failure');
    expect(failure?.message).toContain('Speech');
    expect(failure?.message).toContain('text');
  });

  it('logs a rejection from an executor that previously had no catch', async () => {
    // Only WEBHOOK and NOTIFICATION used to have a .catch — a throw from any of
    // the other five became an unhandled rejection with nothing logged.
    vi.mocked(actions.executeVibration).mockRejectedValueOnce(new Error('motor on fire'));

    runFlowWith({ type: 'VIBRATION', details: { duration: 100 } });
    await vi.waitFor(() => {
      const logs = useAppStore.getState().logs;
      expect(logs.some((l) => l.message.includes('motor on fire'))).toBe(true);
    });
  });

  it('logs a failed result from an executor that previously had no catch', async () => {
    vi.mocked(actions.executeClipboard).mockResolvedValueOnce({ success: false, message: 'denied' });

    runFlowWith({ type: 'CLIPBOARD', details: { text: 'hi' } });
    await vi.waitFor(() => {
      const logs = useAppStore.getState().logs;
      expect(logs.some((l) => l.message === 'Clipboard failed: denied')).toBe(true);
    });
  });
});
