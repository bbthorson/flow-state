import { describe, expect, it } from 'vite-plus/test';
import type { Capability, Flow } from '@flowstate/core';
import {
  createLogAdapter,
  createReferenceBridge,
  createSpaceParticipantAdapter,
  InMemorySpaceTransport,
  type CapabilityAdapter,
} from './index';
import { MemoryStorage, RuntimeHost } from '../../runtime/src/index';

describe('Phase 5 E2E — AT Protocol Space + Invited Reference Bridge DID', () => {
  it('completes a full 2-participant Space command -> checkpoint -> reply -> resume loop', async () => {
    const transport = new InMemorySpaceTransport();
    const spaceUri = 'at://did:plc:user/app.flowstate.space.context/work';
    const bridgeDid = 'did:plc:linear-bridge';

    const bridgeManifest: Capability = {
      id: bridgeDid,
      kind: 'bridge',
      name: 'Linear Bridge',
      did: bridgeDid,
      emits: [
        {
          type: 'linear.issue.created',
          label: 'Issue Created',
          fields: [{ name: 'url', label: 'Issue URL', type: 'url' }],
        },
      ],
      accepts: [
        {
          action: 'createIssue',
          label: 'Create Linear Issue',
          inputs: [{ name: 'title', label: 'Title', type: 'string', required: true }],
        },
      ],
      runtimes: ['remote-did'],
      permissions: [],
    };

    // 1. Start the Reference Bridge DID watching the Context Space
    const bridge = createReferenceBridge({
      manifest: bridgeManifest,
      spaceUri,
      transport,
      async handleCommand(cmd) {
        const title = String(cmd.input.title ?? 'Untitled');
        return {
          eventType: 'linear.issue.created',
          title: `Created: ${title}`,
          payload: { url: `https://linear.app/issue/FS-101`, title },
        };
      },
    });
    await bridge.start();

    // 2. User invites the Bridge DID into their Context Space
    const participantRes = await createSpaceParticipantAdapter({
      userDid: 'did:plc:user',
      appDid: bridgeDid,
      spaceUri,
      transport,
    });
    expect(participantRes.ok).toBe(true);
    if (!participantRes.ok) return;

    const localLogs: string[] = [];
    const logAdapter: CapabilityAdapter = {
      ...createLogAdapter(),
      async execute(cmd) {
        localLogs.push(String(cmd.input.message));
        return { ok: true, message: String(cmd.input.message) };
      },
    };

    // 3. Start User's RuntimeHost with the invited Space participant + local log adapter
    const host = new RuntimeHost({
      storage: new MemoryStorage(),
      adapters: [participantRes.adapter, logAdapter],
      disableTicker: true,
    });
    await host.start();

    const flow: Flow = {
      id: 'flow-quick-issue',
      contextId: 'personal',
      name: 'Quick Linear Capture',
      trigger: { eventType: 'user.manual.invoked' },
      inputs: [{ name: 'title', label: 'Issue Title', type: 'string', required: true }],
      steps: [
        {
          kind: 'command',
          id: 's1',
          bindAs: 'issue',
          targetCapability: bridgeDid,
          action: 'createIssue',
          space: spaceUri,
          input: { title: '{{inputs.title}}' },
          awaitReply: { timeoutMs: 30_000 },
        },
        {
          kind: 'command',
          id: 's2',
          targetCapability: 'local.log',
          action: 'write',
          input: { message: 'Captured {{issue.url}}' },
        },
      ],
      active: true,
      dryRun: false,
      executionTarget: 'device',
      createdAt: '2026-11-27T16:00:00.000Z',
    };
    await host.saveFlow(flow);

    // 4. User taps the pinned App Primitive -> Bridge replies over Space -> Checkpoint resumes!
    await host.runFlowManual('flow-quick-issue', { title: 'Ship Space Bridges' });

    // Allow microtask for async bridge reply delivery
    await new Promise((r) => setTimeout(r, 10));

    expect(localLogs).toEqual(['Captured https://linear.app/issue/FS-101']);
    expect(host.getSnapshot().checkpoints).toHaveLength(0);
    // Incoming Space reply also appears in the brand-stripped Context Stream
    expect(host.getSnapshot().events.some((e) => e.title === 'Created: Ship Space Bridges')).toBe(true);

    host.stop();
    bridge.stop();
  });
});
