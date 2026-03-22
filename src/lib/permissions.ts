import { TriggerType, ActionType, Flow } from '@/types';

export type DevicePermission = 'battery-status' | 'network-information' | 'geolocation' | 'notifications';
export type PermissionState = 'granted' | 'prompt' | 'denied' | 'unavailable';

export const PERMISSION_LABELS: Record<DevicePermission, string> = {
  'battery-status': 'Battery Status',
  'network-information': 'Network Information',
  'geolocation': 'Location',
  'notifications': 'Notifications',
};

export const TRIGGER_PERMISSIONS: Record<TriggerType, DevicePermission[]> = {
  NATIVE_BATTERY: ['battery-status'],
  NETWORK: ['network-information'],
  GEOLOCATION: ['geolocation'],
  DEEP_LINK: [],
  MANUAL: [],
};

export const ACTION_PERMISSIONS: Record<ActionType, DevicePermission[]> = {
  WEBHOOK: [],
  NOTIFICATION: ['notifications'],
  LOG: [],
};

/** Get all unique permissions required by a flow. */
export function getFlowPermissions(flow: Omit<Flow, 'id'>): DevicePermission[] {
  const perms = new Set<DevicePermission>();
  for (const p of TRIGGER_PERMISSIONS[flow.trigger.type]) perms.add(p);
  for (const action of flow.actions) {
    for (const p of ACTION_PERMISSIONS[action.type]) perms.add(p);
  }
  return Array.from(perms);
}

/** Check whether a single permission is available and granted. */
export async function checkPermission(permission: DevicePermission): Promise<PermissionState> {
  if (typeof navigator === 'undefined') return 'unavailable';

  switch (permission) {
    case 'battery-status':
      return typeof (navigator as any).getBattery === 'function' ? 'granted' : 'unavailable';

    case 'network-information':
      return ('connection' in navigator || 'onLine' in navigator) ? 'granted' : 'unavailable';

    case 'geolocation': {
      if (!('geolocation' in navigator)) return 'unavailable';
      try {
        const status = await navigator.permissions.query({ name: 'geolocation' });
        return status.state;
      } catch {
        return 'prompt'; // Permissions API unavailable, but Geolocation API exists
      }
    }

    case 'notifications': {
      if (typeof Notification === 'undefined') return 'unavailable';
      if (Notification.permission === 'granted') return 'granted';
      if (Notification.permission === 'denied') return 'denied';
      return 'prompt';
    }

    default:
      return 'unavailable';
  }
}

/** Check all permissions at once. */
export async function checkAllPermissions(): Promise<Record<DevicePermission, PermissionState>> {
  const [battery, network, geolocation, notifications] = await Promise.all([
    checkPermission('battery-status'),
    checkPermission('network-information'),
    checkPermission('geolocation'),
    checkPermission('notifications'),
  ]);
  return {
    'battery-status': battery,
    'network-information': network,
    geolocation,
    notifications,
  };
}

/** Request a promptable permission. Returns the new state. */
export async function requestPermission(permission: DevicePermission): Promise<PermissionState> {
  switch (permission) {
    case 'geolocation':
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve('granted'),
          (err) => resolve(err.code === err.PERMISSION_DENIED ? 'denied' : 'prompt'),
          { timeout: 10000 }
        );
      });

    case 'notifications': {
      if (typeof Notification === 'undefined') return 'unavailable';
      const result = await Notification.requestPermission();
      if (result === 'granted') return 'granted';
      if (result === 'denied') return 'denied';
      return 'prompt';
    }

    default:
      return checkPermission(permission);
  }
}
