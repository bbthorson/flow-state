export interface TriggerSupport {
  battery: boolean;
  network: boolean;
  visibility: boolean;
}

export function getSupportedTriggers(): TriggerSupport {
  return {
    battery: typeof navigator !== 'undefined' && typeof (navigator as any).getBattery === 'function',
    network: typeof navigator !== 'undefined' && ('connection' in navigator || 'onLine' in navigator),
    visibility: typeof document !== 'undefined' && 'visibilityState' in document,
  };
}

export type PermissionNameWithExtra = PermissionName | 'notifications' | 'geolocation' | 'push';

export async function getPermissionStatus(name: PermissionNameWithExtra): Promise<PermissionState | 'unsupported'> {
  if (typeof navigator === 'undefined' || !navigator.permissions) {
    return 'unsupported';
  }

  try {
    const status = await navigator.permissions.query({ name: name as any });
    return status.state;
  } catch (error) {
    return 'unsupported';
  }
}
