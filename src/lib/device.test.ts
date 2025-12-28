import { describe, it, expect, vi } from 'vitest';
import { getSupportedTriggers, getPermissionStatus } from './device';

describe('getSupportedTriggers', () => {
  it('should detect support for various APIs', () => {
    const support = getSupportedTriggers();
    expect(support).toHaveProperty('battery');
    expect(support).toHaveProperty('network');
    expect(support).toHaveProperty('visibility');
  });

  it('should detect battery support', () => {
    const originalGetBattery = (navigator as any).getBattery;
    (navigator as any).getBattery = vi.fn().mockResolvedValue({});
    
    expect(getSupportedTriggers().battery).toBe(true);
    
    (navigator as any).getBattery = undefined;
    expect(getSupportedTriggers().battery).toBe(false);

    (navigator as any).getBattery = originalGetBattery;
  });
});

describe('getPermissionStatus', () => {
  it('should return unsupported when navigator.permissions is missing', async () => {
    const originalPermissions = navigator.permissions;
    Object.defineProperty(navigator, 'permissions', { value: undefined, configurable: true });
    
    expect(await getPermissionStatus('geolocation' as any)).toBe('unsupported');
    
    Object.defineProperty(navigator, 'permissions', { value: originalPermissions, configurable: true });
  });

  it('should return permission state when supported', async () => {
    const mockStatus = { state: 'granted' };
    const mockQuery = vi.fn().mockResolvedValue(mockStatus);
    const originalPermissions = navigator.permissions;
    
    Object.defineProperty(navigator, 'permissions', { 
      value: { query: mockQuery }, 
      configurable: true 
    });

    expect(await getPermissionStatus('notifications' as any)).toBe('granted');
    expect(mockQuery).toHaveBeenCalledWith({ name: 'notifications' });

    Object.defineProperty(navigator, 'permissions', { value: originalPermissions, configurable: true });
  });
});