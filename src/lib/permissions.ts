import { TriggerType, ActionType, Flow } from '@/types';

export type DevicePermission =
  | 'battery-status'
  | 'network-information'
  | 'geolocation'
  | 'notifications'
  | 'idle-detection'
  | 'device-motion'
  | 'screen-orientation'
  | 'vibration'
  | 'clipboard-write'
  | 'web-share'
  | 'wake-lock'
  | 'speech-synthesis';

export type PermissionState = 'granted' | 'prompt' | 'denied' | 'unavailable';

export const PERMISSION_LABELS: Record<DevicePermission, string> = {
  'battery-status': 'Battery Status',
  'network-information': 'Network Information',
  geolocation: 'Location',
  notifications: 'Notifications',
  'idle-detection': 'Idle Detection',
  'device-motion': 'Device Motion',
  'screen-orientation': 'Screen Orientation',
  vibration: 'Vibration',
  'clipboard-write': 'Clipboard',
  'web-share': 'Web Share',
  'wake-lock': 'Wake Lock',
  'speech-synthesis': 'Text to Speech',
};

export const PERMISSION_DESCRIPTIONS: Record<DevicePermission, string> = {
  'battery-status': 'Monitor battery level and charging state.',
  'network-information': 'Detect connectivity and network type.',
  geolocation: 'Access device location for geofencing.',
  notifications: 'Show browser notifications.',
  'idle-detection': 'Detect when the user is inactive.',
  'device-motion': 'Detect shakes and device orientation.',
  'screen-orientation': 'Detect portrait/landscape changes.',
  vibration: 'Provide haptic feedback.',
  'clipboard-write': 'Copy text to the clipboard.',
  'web-share': 'Share content via the system share sheet.',
  'wake-lock': 'Keep the screen awake.',
  'speech-synthesis': 'Speak text aloud.',
};

export const TRIGGER_PERMISSIONS: Record<TriggerType, DevicePermission[]> = {
  NATIVE_BATTERY: ['battery-status'],
  NETWORK: ['network-information'],
  GEOLOCATION: ['geolocation'],
  DEEP_LINK: [],
  MANUAL: [],
  IDLE: ['idle-detection'],
  DEVICE_MOTION: ['device-motion'],
  SCREEN_ORIENTATION: ['screen-orientation'],
};

export const ACTION_PERMISSIONS: Record<ActionType, DevicePermission[]> = {
  WEBHOOK: [],
  NOTIFICATION: ['notifications'],
  LOG: [],
  VIBRATION: ['vibration'],
  CLIPBOARD: ['clipboard-write'],
  WEB_SHARE: ['web-share'],
  WAKE_LOCK: ['wake-lock'],
  SPEECH: ['speech-synthesis'],
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
        return 'prompt';
      }
    }

    case 'notifications': {
      if (typeof Notification === 'undefined') return 'unavailable';
      if (Notification.permission === 'granted') return 'granted';
      if (Notification.permission === 'denied') return 'denied';
      return 'prompt';
    }

    case 'idle-detection': {
      if (!('IdleDetector' in window)) return 'unavailable';
      try {
        const status = await (window as any).IdleDetector.requestPermission();
        return status === 'granted' ? 'granted' : 'prompt';
      } catch {
        return 'prompt';
      }
    }

    case 'device-motion':
      return typeof DeviceMotionEvent !== 'undefined' ? 'granted' : 'unavailable';

    case 'screen-orientation':
      return screen?.orientation ? 'granted' : 'unavailable';

    case 'vibration':
      return typeof navigator.vibrate === 'function' ? 'granted' : 'unavailable';

    case 'clipboard-write':
      return navigator.clipboard ? 'granted' : 'unavailable';

    case 'web-share':
      return typeof navigator.share === 'function' ? 'granted' : 'unavailable';

    case 'wake-lock':
      return 'wakeLock' in navigator ? 'granted' : 'unavailable';

    case 'speech-synthesis':
      return typeof speechSynthesis !== 'undefined' ? 'granted' : 'unavailable';

    default:
      return 'unavailable';
  }
}

/** All permission keys in display order. */
export const ALL_PERMISSIONS: DevicePermission[] = [
  'battery-status',
  'network-information',
  'geolocation',
  'notifications',
  'idle-detection',
  'device-motion',
  'screen-orientation',
  'vibration',
  'clipboard-write',
  'web-share',
  'wake-lock',
  'speech-synthesis',
];

/** Check all permissions at once. */
export async function checkAllPermissions(): Promise<Record<DevicePermission, PermissionState>> {
  const results = await Promise.all(ALL_PERMISSIONS.map(checkPermission));
  const map = {} as Record<DevicePermission, PermissionState>;
  ALL_PERMISSIONS.forEach((p, i) => { map[p] = results[i]; });
  return map;
}

/** Permissions that can be prompted via requestPermission. */
const PROMPTABLE: DevicePermission[] = ['geolocation', 'notifications', 'idle-detection'];

export function isPromptable(permission: DevicePermission): boolean {
  return PROMPTABLE.includes(permission);
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

    case 'idle-detection': {
      if (!('IdleDetector' in window)) return 'unavailable';
      try {
        const result = await (window as any).IdleDetector.requestPermission();
        return result === 'granted' ? 'granted' : 'denied';
      } catch {
        return 'denied';
      }
    }

    default:
      return checkPermission(permission);
  }
}
