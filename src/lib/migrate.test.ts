import { describe, it, expect } from 'vitest';
import { isV1Flow, migrateFlowV1, rewriteTemplate } from './migrate';
import { parseRecipe } from './flow-schema';
import { newStepId, checkStepLimits } from './steps';

describe('rewriteTemplate', () => {
  it.each([
    ['{{level}}', '{{trigger.level}}'],
    ['{{ level }}', '{{trigger.level}}'],
    ['{{params.threshold}}', '{{threshold}}'],
    ['{{secrets.key}}', '{{secrets.key}}'],
    // v1 had no device/time roots: these were (missing) trigger keys.
    ['{{device.name}}', '{{trigger.device.name}}'],
    ['At {{time}} on {{day}}', 'At {{trigger.time}} on {{trigger.day}}'],
  ])('%s → %s', (input, output) => {
    expect(rewriteTemplate(input)).toBe(output);
  });
});

describe('migrateFlowV1', () => {
  const v1 = {
    id: 'f1',
    name: 'Discord alert',
    enabled: true,
    securityKey: 'deep-link-key',
    scope: 'local',
    visibility: 'public',
    secrets: { webhook_url: 'https://discord.com/api/webhooks/1/x' },
    parameters: [
      { key: 'webhook_url', label: 'Webhook', type: 'secret', required: true },
      { key: 'room', label: 'Room', type: 'string', default: 'kitchen', description: 'Which room' },
    ],
    trigger: { type: 'NATIVE_BATTERY', details: { charging: false, level: 0.15 } },
    actions: [
      { type: 'WEBHOOK', details: { url: '{{secrets.webhook_url}}', body: '{"msg":"{{level}} in {{params.room}}"}' } },
      { type: 'VIBRATION', details: { duration: 200 } },
    ],
  };

  it('recognises v1 flows', () => {
    expect(isV1Flow(v1)).toBe(true);
    expect(isV1Flow(migrateFlowV1(v1))).toBe(false);
  });

  it('produces a valid v2 flow', () => {
    const flow = migrateFlowV1(v1);
    const parsed = parseRecipe(flow);
    expect(parsed.ok, parsed.ok ? '' : parsed.reason).toBe(true);
    expect(flow).toMatchObject({ id: 'f1', active: true, dryRun: false });
    expect(flow).not.toHaveProperty('scope');
    expect(flow).not.toHaveProperty('visibility');
  });

  it('turns parameters into leading variables and actions into steps, in order', () => {
    const flow = migrateFlowV1(v1);
    expect(flow.steps.map((s) => s.type)).toEqual(['variable', 'variable', 'action', 'action']);
    expect(flow.steps[0]).toMatchObject({ name: 'webhook_url', kind: 'secret', label: 'Webhook', required: true });
    expect(flow.steps[0]).not.toHaveProperty('value');
    expect(flow.steps[1]).toMatchObject({ name: 'room', value: 'kitchen', note: 'Which room' });
  });

  it('rewrites templates to v2 roots', () => {
    const webhook = migrateFlowV1(v1).steps[2];
    expect(webhook).toMatchObject({
      action: { details: { url: '{{secrets.webhook_url}}', body: '{"msg":"{{trigger.level}} in {{room}}"}' } },
    });
  });

  it('keeps the deep-link key as a device-only secret', () => {
    expect(migrateFlowV1(v1).secrets).toEqual({ webhook_url: 'https://discord.com/api/webhooks/1/x', securityKey: 'deep-link-key' });
  });
});

describe('newStepId', () => {
  it('is 13 chars of the TID alphabet and sorts by time', () => {
    const a = newStepId();
    const b = newStepId();
    expect(a).toMatch(/^[234567a-z]{13}$/);
    expect(b > a).toBe(true);
  });
});

describe('checkStepLimits', () => {
  it('rejects more than 25 steps', () => {
    const steps = Array.from({ length: 26 }, (_, i) => ({ type: 'cancelScheduled' as const, id: `s${i}`, identifier: 'x' }));
    expect(checkStepLimits(steps)).toMatch(/26 steps/);
  });
});
