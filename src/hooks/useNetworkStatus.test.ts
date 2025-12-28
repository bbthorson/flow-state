import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useNetworkStatus } from './useNetworkStatus';
import { useDeviceStore } from '@/store/useDeviceStore';

describe('useNetworkStatus', () => {
  beforeEach(() => {
    useDeviceStore.setState({
      network: { online: true, type: 'unknown', effectiveType: 'unknown', supported: true }
    });
  });

  it('should update store when going offline', () => {
    renderHook(() => useNetworkStatus());
    
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    
    expect(useDeviceStore.getState().network.online).toBe(false);
  });

  it('should update store when going online', () => {
    useDeviceStore.setState({ network: { ...useDeviceStore.getState().network, online: false } });
    renderHook(() => useNetworkStatus());
    
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    
    expect(useDeviceStore.getState().network.online).toBe(true);
  });
});
