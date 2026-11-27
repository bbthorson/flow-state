import { describe, expect, it, vi } from 'vite-plus/test';
import type { Flow } from '@flowstate/core';
import { handleHubRequest, UserHubEngine } from './index';

describe('@flowstate/hub — HTTPS inbox, revocation & opt-in Hub runner', () => {
  it('validates sender tokens, fans out Web Push, and runs opt-in Hub flows', async () => {
    const sendWebPush = vi.fn(async () => {});
    const dispatchCommand = vi.fn(async () => ({ ok: true }));
    const hub = new UserHubEngine({ sendWebPush, dispatchCommand });

    hub.registerToken({
      token: 'tok-ci-deploy',
      label: 'GitHub Actions',
      allowedContexts: ['ctx-oncall'],
      revoked: false,
      createdAt: '2026-11-27T16:00:00.000Z',
    });

    hub.registerPushSubscription({
      id: 'phone-1',
      endpoint: 'https://push.example/sub1',
      keys: { p256dh: 'k1', auth: 'a1' },
      createdAt: '2026-11-27T16:00:00.000Z',
    });

    const hubFlow: Flow = {
      id: 'hub-f1',
      contextId: 'ctx-oncall',
      name: 'Deploy Failed -> Escalate',
      trigger: { eventType: 'deploy.failed' },
      inputs: [],
      steps: [
        {
          kind: 'command',
          id: 'c1',
          targetCapability: 'did:plc:pager-bridge',
          action: 'page',
          input: { summary: 'Failed: {{event.title}}' },
        },
      ],
      active: true,
      dryRun: false,
      executionTarget: 'hub',
      createdAt: '2026-11-27T16:00:00.000Z',
    };
    hub.upsertHubFlow(hubFlow);

    const req = new Request('https://flowstate.app/hub/e/tok-ci-deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'deploy.failed',
        title: 'prod-api build #412',
        urgency: 'high',
        space: 'ctx-oncall',
      }),
    });

    const res = await handleHubRequest(req, async (t) => (t === 'tok-ci-deploy' ? hub : null));
    expect(res.status).toBe(202);
    expect(sendWebPush).toHaveBeenCalledTimes(1);
    expect(dispatchCommand).toHaveBeenCalledTimes(1);
    expect((dispatchCommand.mock.calls[0] as any)[0].input).toEqual({
      summary: 'Failed: prod-api build #412',
    });

    // Revoking token immediately blocks further ingress
    hub.revokeToken('tok-ci-deploy');
    const res2 = await handleHubRequest(
      new Request('https://flowstate.app/hub/e/tok-ci-deploy', {
        method: 'POST',
        body: JSON.stringify({ event: 'deploy.failed' }),
      }),
      async () => hub,
    );
    expect(res2.status).toBe(401);
  });
});
