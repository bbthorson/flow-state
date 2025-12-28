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
      network: { online: true, type: 'wifi', effectiveType: '4g', supported: true },
      geolocation: { latitude: null, longitude: null, accuracy: null, speed: null, supported: true }
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

  it('should trigger flows when entering a geofence', async () => {
    const flowId = 'geo-flow-1';
    useAppStore.setState({
      flows: [{
        id: flowId,
        name: 'Home Flow',
        enabled: true,
        trigger: {
          type: 'GEOLOCATION',
          details: {
            latitude: 45.0,
            longitude: 90.0,
            radius: 100, // 100 meters
            event: 'ENTER'
          }
        },
        actions: []
      } as any]
    });

    const { rerender } = renderHook(() => useFlowTriggerManager());

    // 1. Initial position: Outside (Distance is ~157km from 45,90 to 46,91)
    act(() => {
      useDeviceStore.getState().updateGeolocation({ latitude: 46.0, longitude: 91.0 });
    });
    act(() => vi.advanceTimersByTime(5000));
    rerender();
    
    expect(useAppStore.getState().triggerFlows).not.toHaveBeenCalled();

    // 2. Move Inside: (Distance is 0)
    act(() => {
      useDeviceStore.getState().updateGeolocation({ latitude: 45.0, longitude: 90.0 });
    });
    act(() => vi.advanceTimersByTime(5000));
    rerender();

    expect(useAppStore.getState().triggerFlows).toHaveBeenCalledWith(
      'GEOLOCATION',
      expect.objectContaining({ event: 'ENTER' }),
      flowId
    );
  });

  it('should trigger flows when exiting a geofence', async () => {
    const flowId = 'geo-flow-2';
    useAppStore.setState({
      flows: [{
        id: flowId,
        name: 'Leave Home Flow',
        enabled: true,
        trigger: {
          type: 'GEOLOCATION',
          details: {
            latitude: 45.0,
            longitude: 90.0,
            radius: 100,
            event: 'EXIT'
          }
        },
        actions: []
      } as any]
    });

    const { rerender } = renderHook(() => useFlowTriggerManager());

    // 1. Initial position: Inside
    act(() => {
      useDeviceStore.getState().updateGeolocation({ latitude: 45.0, longitude: 90.0 });
    });
    act(() => vi.advanceTimersByTime(5000));
    rerender();
    
    expect(useAppStore.getState().triggerFlows).not.toHaveBeenCalled();

    // 2. Move Outside
    act(() => {
      useDeviceStore.getState().updateGeolocation({ latitude: 46.0, longitude: 91.0 });
    });
    act(() => vi.advanceTimersByTime(5000));
    rerender();

    expect(useAppStore.getState().triggerFlows).toHaveBeenCalledWith(
      'GEOLOCATION',
      expect.objectContaining({ event: 'EXIT' }),
      flowId
    );
  });
});
