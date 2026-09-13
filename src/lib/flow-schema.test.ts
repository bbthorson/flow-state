import { describe, it, expect } from 'vitest';
import { parseFlowRecord } from './flow-schema';
import { STARTER_FLOWS } from './templates';

/** A record that validates, as a base for targeted mutations. */
const validRecord = () => ({
  name: 'Low battery alert',
  enabled: true,
  trigger: { type: 'NATIVE_BATTERY', details: { level: 0.2, charging: false } },
  actions: [{ type: 'NOTIFICATION', details: { title: 'Battery low' } }],
});

describe('parseFlowRecord', () => {
  it('accepts a well-formed record', () => {
    const result = parseFlowRecord(validRecord());
    expect(result.ok).toBe(true);
  });

  // The check is worthless if it rejects the app's own output: every starter
  // flow is something a user can create and publish.
  it.each(STARTER_FLOWS.map((f) => [f.name, f] as const))(
    'accepts the app\'s own starter flow: %s',
    (_name, flow) => {
      const record = {
        name: flow.name,
        enabled: flow.enabled,
        trigger: flow.trigger,
        actions: flow.actions,
      };
      const result = parseFlowRecord(record);
      expect(result.ok, result.ok ? '' : result.reason).toBe(true);
    },
  );

  describe('rejects records that would break the app', () => {
    const cases: Array<[string, unknown]> = [
      ['null', null],
      ['a string', 'not a record'],
      ['an array', []],
      ['a missing trigger', { ...validRecord(), trigger: undefined }],
      ['a trigger that is not an object', { ...validRecord(), trigger: 'NATIVE_BATTERY' }],
      ['a trigger with no type', { ...validRecord(), trigger: { details: {} } }],
      ['an unknown trigger type', { ...validRecord(), trigger: { type: 'MIND_READING', details: {} } }],
      ['trigger details missing', { ...validRecord(), trigger: { type: 'MANUAL' } }],
      ['missing actions', { ...validRecord(), actions: undefined }],
      ['actions not an array', { ...validRecord(), actions: { type: 'LOG' } }],
      ['an empty actions array', { ...validRecord(), actions: [] }],
      ['an unknown action type', { ...validRecord(), actions: [{ type: 'LAUNCH_MISSILE', details: {} }] }],
      ['a missing name', { ...validRecord(), name: undefined }],
      ['an empty name', { ...validRecord(), name: '' }],
      ['a non-boolean enabled', { ...validRecord(), enabled: 'yes' }],
    ];

    it.each(cases)('%s', (_label, record) => {
      expect(parseFlowRecord(record).ok).toBe(false);
    });
  });

  describe('per-type detail requirements', () => {
    it('rejects a geolocation trigger with no coordinates', () => {
      // This one is the point of the exercise: it would install cleanly and then
      // silently never fire, or compare against NaN.
      const result = parseFlowRecord({
        ...validRecord(),
        trigger: { type: 'GEOLOCATION', details: { radius: 100 } },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toContain('trigger.details.latitude');
    });

    it('rejects a geolocation event that is neither ENTER nor EXIT', () => {
      // FlowDetailPage renders anything that isn't ENTER as "Exit" — the
      // opposite of a missing value, not an unknown one.
      const result = parseFlowRecord({
        ...validRecord(),
        trigger: {
          type: 'GEOLOCATION',
          details: { latitude: 1, longitude: 2, radius: 100, event: 'MAYBE' },
        },
      });

      expect(result.ok).toBe(false);
    });

    it('rejects a webhook action with no url', () => {
      const result = parseFlowRecord({
        ...validRecord(),
        actions: [{ type: 'WEBHOOK', details: { method: 'POST' } }],
      });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toContain('url');
    });

    it('rejects an out-of-range latitude', () => {
      const result = parseFlowRecord({
        ...validRecord(),
        trigger: {
          type: 'GEOLOCATION',
          details: { latitude: 950, longitude: 2, radius: 100, event: 'ENTER' },
        },
      });

      expect(result.ok).toBe(false);
    });

    it('rejects a TIME trigger whose time is not HH:MM', () => {
      const result = parseFlowRecord({
        ...validRecord(),
        trigger: { type: 'TIME', details: { time: 'half past nine' } },
      });

      expect(result.ok).toBe(false);
    });
  });

  it('keeps unknown detail keys instead of stripping them', () => {
    // DEEP_LINK matching compares every key of trigger.details against the
    // incoming params, so dropping extras would silently widen what matches.
    const result = parseFlowRecord({
      ...validRecord(),
      trigger: { type: 'DEEP_LINK', details: { event: 'arrived', room: 'kitchen' } },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record.trigger.details).toEqual({ event: 'arrived', room: 'kitchen' });
    }
  });

  it('names the offending field so a skipped record can be debugged', () => {
    const result = parseFlowRecord({ ...validRecord(), name: '' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('name');
  });
});
