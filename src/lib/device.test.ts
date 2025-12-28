import { describe, it, expect, vi } from 'vitest';
import { getSupportedTriggers } from './device';

describe('getSupportedTriggers', () => {
  it('should detect support for various APIs', () => {
    // Mock navigator and document if needed, but for now we just check if it returns an object
    const support = getSupportedTriggers();
    expect(support).toHaveProperty('battery');
    expect(support).toHaveProperty('network');
    expect(support).toHaveProperty('visibility');
  });

  it('should detect battery support', () => {
    // Mock navigator.getBattery
    const originalGetBattery = navigator.getBattery;
    (navigator as any).getBattery = vi.fn().mockResolvedValue({});
    
    expect(getSupportedTriggers().battery).toBe(true);
    
    (navigator as any).getBattery = undefined;
    expect(getSupportedTriggers().battery).toBe(false);

    // Restore
    (navigator as any).getBattery = originalGetBattery;
  });
});
