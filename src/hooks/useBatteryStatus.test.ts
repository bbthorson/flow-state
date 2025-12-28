import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
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
    useDeviceStore.setState({
      battery: { level: 1, charging: false, supported: true }
    });
    
    (navigator as any).getBattery = vi.fn().mockResolvedValue(mockBattery);
  });

  it('should update store with battery status', async () => {
    let result: any;
    await act(async () => {
      result = renderHook(() => useBatteryStatus());
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
    
    mockBattery.level = 0.7;
    act(() => {
      handler();
    });
    
    expect(useDeviceStore.getState().battery.level).toBe(0.7);
  });

  it('should handle unsupported battery API', async () => {
    (navigator as any).getBattery = undefined;
    
    await act(async () => {
      renderHook(() => useBatteryStatus());
    });
    
    expect(useDeviceStore.getState().battery.supported).toBe(false);
  });
});
