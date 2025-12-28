import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useBatteryStatus } from './useBatteryStatus';
import { useDeviceStore } from '@/store/useDeviceStore';

describe('useBatteryStatus', () => {
  const mockBattery = {
    level: 0.8,
    charging: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    useDeviceStore.setState({
      battery: { level: 1, charging: false, supported: true }
    });
    
    (navigator as any).getBattery = vi.fn().mockResolvedValue(mockBattery);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should update store with battery status', async () => {
    let result: any;
    await act(async () => {
      result = renderHook(() => useBatteryStatus());
    });
    
    // Advance timer for debounce
    act(() => {
        vi.advanceTimersByTime(5000);
    });

    expect(useDeviceStore.getState().battery.level).toBe(0.8);
    expect(useDeviceStore.getState().battery.charging).toBe(true);
  });

  it('should update store when battery level changes', async () => {
    let handler: any;
    mockBattery.addEventListener.mockImplementation((event, cb) => {
      if (event === 'levelchange') handler = cb;
    });

    await act(async () => {
      renderHook(() => useBatteryStatus());
    });
    
    // Initial update debounce
    act(() => {
        vi.advanceTimersByTime(5000);
    });

    mockBattery.level = 0.7;
    act(() => {
      handler();
    });
    
    // Change update debounce
    act(() => {
        vi.advanceTimersByTime(5000);
    });
    
    expect(useDeviceStore.getState().battery.level).toBe(0.7);
  });

  it('should handle unsupported battery API', async () => {
    (navigator as any).getBattery = undefined;
    
    await act(async () => {
      renderHook(() => useBatteryStatus());
    });

    // Unsupported update debounce
    act(() => {
        vi.advanceTimersByTime(5000);
    });
    
    expect(useDeviceStore.getState().battery.supported).toBe(false);
  });
});
