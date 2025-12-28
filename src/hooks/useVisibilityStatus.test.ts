import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useVisibilityStatus } from './useVisibilityStatus';
import { useDeviceStore } from '@/store/useDeviceStore';

describe('useVisibilityStatus', () => {
  beforeEach(() => {
    useDeviceStore.setState({
      visibility: { state: 'visible', supported: true }
    });
    
    // Mock document.visibilityState
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible'
    });
  });

  it('should update store when visibility changes', () => {
    renderHook(() => useVisibilityStatus());
    
    // Change mock value
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden'
    });
    
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    
    expect(useDeviceStore.getState().visibility.state).toBe('hidden');
  });
});
