import { describe, it, expect } from 'vitest';
import { triggerSummary } from './flow-constants';

describe('triggerSummary', () => {
  it('describes a complete battery trigger', () => {
    expect(triggerSummary({ type: 'NATIVE_BATTERY', details: { level: 0.2, charging: false } }))
      .toBe('Battery discharging at 20%');
  });

  it('describes a complete geolocation trigger', () => {
    expect(triggerSummary({ type: 'GEOLOCATION', details: { event: 'ENTER', radius: 100 } }))
      .toBe('Enter zone (100m radius)');
    expect(triggerSummary({ type: 'GEOLOCATION', details: { event: 'EXIT', radius: 100 } }))
      .toBe('Exit zone (100m radius)');
  });

  describe('missing values are reported as missing, never as the opposite', () => {
    it('does not call a geolocation trigger with no event an "Exit"', () => {
      const summary = triggerSummary({ type: 'GEOLOCATION', details: { radius: 100 } });

      expect(summary).not.toContain('Exit');
      expect(summary).not.toContain('Enter');
      expect(summary).toContain('direction not set');
    });

    it('does not invent 0% for a battery trigger with no level', () => {
      const summary = triggerSummary({ type: 'NATIVE_BATTERY', details: { charging: true } });

      expect(summary).not.toContain('0%');
      expect(summary).toBe('Battery charging');
    });

    it('does not call a battery trigger with no charging state "discharging"', () => {
      const summary = triggerSummary({ type: 'NATIVE_BATTERY', details: { level: 0.5 } });

      expect(summary).not.toContain('discharging');
      expect(summary).toBe('Battery at 50%');
    });

    it('does not call a network trigger with no online flag "offline"', () => {
      const summary = triggerSummary({ type: 'NETWORK', details: {} });

      expect(summary).not.toContain('offline');
      expect(summary).toBe('Network change');
    });

    it('does not invent a 0s idle threshold', () => {
      expect(triggerSummary({ type: 'IDLE', details: {} })).toBe('Idle (no threshold set)');
    });

    it('survives details being absent entirely', () => {
      expect(() =>
        triggerSummary({ type: 'MANUAL', details: undefined as never }),
      ).not.toThrow();
    });
  });
});
