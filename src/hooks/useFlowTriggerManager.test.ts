import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useFlowTriggerManager } from './useFlowTriggerManager';
import { useDeviceStore } from '@/store/useDeviceStore';
import { useAppStore } from '@/store/useAppStore';

describe('useFlowTriggerManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useDeviceStore.setState({
      battery: { level: 1, charging: false, supported: true },
      network: { online: true, type: 'wifi', effectiveType: '4g', supported: true }
    });
    useAppStore.setState({ flows: [], logs: [] });
    
    // Mock triggerFlows
    useAppStore.getState().triggerFlows = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should trigger flows when battery charging status changes', async () => {
    renderHook(() => useFlowTriggerManager());

    // Update battery in store (simulating debounce completion)
    act(() => {
      useDeviceStore.getState().updateBattery({ charging: true });
    });
    
    // Before debounce
    expect(useAppStore.getState().triggerFlows).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(useAppStore.getState().triggerFlows).toHaveBeenCalledWith('NATIVE_BATTERY', { charging: true });
  });

  it('should trigger flows when network online status changes', async () => {
    renderHook(() => useFlowTriggerManager());

    // Update network in store
    act(() => {
      useDeviceStore.getState().updateNetwork({ online: false });
    });
    
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(useAppStore.getState().triggerFlows).toHaveBeenCalledWith('NETWORK', { online: false });
  });
});
