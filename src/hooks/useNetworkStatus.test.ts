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

  it('should update network type from navigator.connection', () => {
    const mockConnection = {
      type: 'wifi',
      effectiveType: '4g',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    (navigator as any).connection = mockConnection;
    
    renderHook(() => useNetworkStatus());
    
    expect(useDeviceStore.getState().network.type).toBe('wifi');
    expect(useDeviceStore.getState().network.effectiveType).toBe('4g');
  });

  it('should update when network connection changes', () => {
    let handler: any;
    const mockConnection = {
      type: 'wifi',
      effectiveType: '4g',
      addEventListener: vi.fn().mockImplementation((event, cb) => {
        if (event === 'change') handler = cb;
      }),
      removeEventListener: vi.fn(),
    };
    (navigator as any).connection = mockConnection;
    
    renderHook(() => useNetworkStatus());
    
    mockConnection.type = 'cellular';
    mockConnection.effectiveType = '3g';
    act(() => {
      handler();
    });
    
    expect(useDeviceStore.getState().network.type).toBe('cellular');
    expect(useDeviceStore.getState().network.effectiveType).toBe('3g');
  });
});
