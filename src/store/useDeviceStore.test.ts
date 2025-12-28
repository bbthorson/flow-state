import { describe, it, expect } from 'vitest';
import { useDeviceStore } from './useDeviceStore';

describe('useDeviceStore', () => {
  it('should have initial state', () => {
    const state = useDeviceStore.getState();
    expect(state.battery).toEqual({
      level: 1,
      charging: false,
      supported: false,
    });
    expect(state.network).toEqual({
      online: true,
      type: 'unknown',
      effectiveType: 'unknown',
      supported: false,
    });
    expect(state.visibility).toEqual({
      state: 'visible',
      supported: false,
    });
  });

  it('should update battery state', () => {
    const { updateBattery } = useDeviceStore.getState();
    updateBattery({ level: 0.5, charging: true });
    
    const state = useDeviceStore.getState();
    expect(state.battery.level).toBe(0.5);
    expect(state.battery.charging).toBe(true);
  });

  it('should update network state', () => {
    const { updateNetwork } = useDeviceStore.getState();
    updateNetwork({ online: false, type: 'wifi' });
    
    const state = useDeviceStore.getState();
    expect(state.network.online).toBe(false);
    expect(state.network.type).toBe('wifi');
  });

  it('should update visibility state', () => {
    const { updateVisibility } = useDeviceStore.getState();
    updateVisibility({ state: 'hidden' });
    
    const state = useDeviceStore.getState();
    expect(state.visibility.state).toBe('hidden');
  });
});
