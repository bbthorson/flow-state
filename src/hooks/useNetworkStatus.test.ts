import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useNetworkStatus } from './useNetworkStatus';
import { useDeviceStore } from '@/store/useDeviceStore';

describe('useNetworkStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useDeviceStore.setState({
      network: { online: true, type: 'unknown', effectiveType: 'unknown', supported: true }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should update store when going offline', () => {
    renderHook(() => useNetworkStatus());
    
    // Initial state update
    act(() => {
        vi.advanceTimersByTime(5000);
    });

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    
    // Event update
    act(() => {
        vi.advanceTimersByTime(5000);
    });

    expect(useDeviceStore.getState().network.online).toBe(false);
  });

  it('should update store when going online', () => {
    useDeviceStore.setState({ network: { ...useDeviceStore.getState().network, online: false } });
    renderHook(() => useNetworkStatus());
    
    // Initial state update
    act(() => {
        vi.advanceTimersByTime(5000);
    });

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    
    // Event update
    act(() => {
        vi.advanceTimersByTime(5000);
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
    
    // Initial state update
    act(() => {
        vi.advanceTimersByTime(5000);
    });
    
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
    
    // Initial state update
    act(() => {
        vi.advanceTimersByTime(5000);
    });

    mockConnection.type = 'cellular';
    mockConnection.effectiveType = '3g';
    act(() => {
      handler();
    });
    
    // Change update
    act(() => {
        vi.advanceTimersByTime(5000);
    });

    expect(useDeviceStore.getState().network.type).toBe('cellular');
    expect(useDeviceStore.getState().network.effectiveType).toBe('3g');
  });
});
