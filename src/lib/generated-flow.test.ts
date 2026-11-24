import { describe, it, expect } from 'vitest';
import { extractJson, normalizeGeneratedFlow } from './generated-flow';
import { parseRecipe } from './flow-schema';

describe('normalizeGeneratedFlow', () => {
  it('accepts the v2 shape from the prompt and gives every step an id', () => {
    const flow = normalizeGeneratedFlow({
      name: 'Shake to share',
      trigger: { type: 'DEVICE_MOTION', details: { gesture: 'SHAKE' } },
      steps: [
        { type: 'condition', assertions: [{ field: 'time.hour', operator: 'gte', value: 8 }] },
        { type: 'action', action: { type: 'WEB_SHARE', details: { text: 'hi' } } },
      ],
    });
    expect(flow).not.toBeNull();
    expect(flow!.steps.every((s) => /^[234567a-z]{13}$/.test(s.id))).toBe(true);
    expect(flow!.steps[0]).toMatchObject({ type: 'condition', assertions: [{ field: 'time.hour', operator: 'gte', value: '8' }] });
    const parsed = parseRecipe(flow);
    expect(parsed.ok, parsed.ok ? '' : parsed.reason).toBe(true);
  });

  it('still accepts the old flat actions list and bare actions', () => {
    const flow = normalizeGeneratedFlow({
      name: 'Low battery',
      trigger: { type: 'NATIVE_BATTERY', details: { charging: false, level: 0.2 } },
      actions: [{ type: 'NOTIFICATION', details: { title: 'Battery at {{level}}' } }],
    });
    expect(flow!.steps).toEqual([
      expect.objectContaining({ type: 'action', action: { type: 'NOTIFICATION', details: { title: 'Battery at {{trigger.level}}' } } }),
    ]);
  });

  it('keeps reserved roots in templates as they are', () => {
    const flow = normalizeGeneratedFlow({
      trigger: { type: 'MANUAL', details: {} },
      steps: [{ type: 'NOTIFICATION', details: { title: '{{time.hour}} {{device.battery.level}} {{trigger.x}}' } }],
    });
    expect(flow!.steps[0]).toMatchObject({ action: { details: { title: '{{time.hour}} {{device.battery.level}} {{trigger.x}}' } } });
    expect(flow!.name).toBe('New Flow');
  });

  it('drops what it cannot place', () => {
    const flow = normalizeGeneratedFlow({
      name: 'x',
      trigger: { type: 'MANUAL', details: {} },
      steps: [
        { type: 'action', action: { type: 'LAUNCH_MISSILE', details: {} } },
        { type: 'condition', assertions: [] },
        { type: 'LOG', details: { message: 'kept' } },
      ],
    });
    expect(flow!.steps).toHaveLength(1);
    expect(flow!.steps[0]).toMatchObject({ action: { type: 'LOG' } });
  });

  it('keeps branches, within the depth limit', () => {
    const leaf = { type: 'LOG', details: {} };
    const branch = (inner: unknown[]) => ({ type: 'condition', assertions: [{ field: 'time.hour', value: '1' }], then: inner, else: [] });
    const flow = normalizeGeneratedFlow({ trigger: { type: 'MANUAL', details: {} }, steps: [branch([branch([branch([leaf])])])] });
    expect(parseRecipe(flow).ok).toBe(true);
  });

  it.each([null, 'text', {}, { trigger: { type: 'TELEPATHY', details: {} }, steps: [{ type: 'LOG', details: {} }] }, { trigger: { type: 'MANUAL' }, steps: [] }])(
    'returns null for %j',
    (raw) => {
      expect(normalizeGeneratedFlow(raw)).toBeNull();
    },
  );
});

describe('extractJson', () => {
  it('reads JSON inside a code fence', () => {
    expect(extractJson('Here you go:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it('returns null for broken JSON', () => {
    expect(extractJson('{"a":')).toBeNull();
  });
});
