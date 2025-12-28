import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDeviceStore } from './useDeviceStore';

describe('useDeviceStore Debouncing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useDeviceStore.setState({
      battery: { level: 1, charging: false, supported: true, pending: undefined },
      network: { online: true, type: 'wifi', effectiveType: '4g', supported: true, pending: undefined },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should debounce battery level updates', () => {
    const { updateBattery } = useDeviceStore.getState();
    
    // Initial update should set pending state
    updateBattery({ level: 0.9 });
    
    // Immediate check - should not be updated yet
    expect(useDeviceStore.getState().battery.level).toBe(1);
    expect(useDeviceStore.getState().battery.pending).toEqual({ level: 0.9 });

    // Advance timer by 2 seconds (less than threshold)
    vi.advanceTimersByTime(2000);
    expect(useDeviceStore.getState().battery.level).toBe(1);

    // Another update comes in, resetting the timer
    updateBattery({ level: 0.8 });
    vi.advanceTimersByTime(2000);
    expect(useDeviceStore.getState().battery.level).toBe(1);
    expect(useDeviceStore.getState().battery.pending).toEqual({ level: 0.8 });

    // Advance past threshold (assuming 5000ms)
    vi.advanceTimersByTime(5000);
    expect(useDeviceStore.getState().battery.level).toBe(0.8);
    expect(useDeviceStore.getState().battery.pending).toBeUndefined();
  });

  it('should debounce network online status updates', () => {
    const { updateNetwork } = useDeviceStore.getState();
    
    updateNetwork({ online: false });
    
    expect(useDeviceStore.getState().network.online).toBe(true);
    expect(useDeviceStore.getState().network.pending).toEqual({ online: false });

    vi.advanceTimersByTime(5000);
    expect(useDeviceStore.getState().network.online).toBe(false);
  });
});
