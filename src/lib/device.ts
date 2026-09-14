export interface TriggerSupport {
  battery: boolean;
  network: boolean;
  visibility: boolean;
  /**
   * The Network Information API specifically (connection type / effectiveType).
   * `network` above is true as long as we can tell online from offline, which
   * every browser can — this is the narrower question.
   */
  connectionType: boolean;
}

/**
 * Synchronous capability probes.
 *
 * These answer "can this device report X at all", which is available
 * immediately — unlike the readings in `useDeviceStore`, whose `supported`
 * flags only flip once a value has actually arrived (and those updates are
 * debounced by 5s). Use these to tell "unsupported" apart from "not read yet"
 * so the UI doesn't claim a sensor is missing while it is still being read.
 */
export function getSupportedTriggers(): TriggerSupport {
  return {
    battery: typeof navigator !== 'undefined' && typeof (navigator as any).getBattery === 'function',
    network: typeof navigator !== 'undefined' && ('connection' in navigator || 'onLine' in navigator),
    visibility: typeof document !== 'undefined' && 'visibilityState' in document,
    // Checked by value, not by key: a `connection` property that exists but
    // holds undefined still answers true to an `in` test, and the hooks that
    // read it would then never report anything.
    connectionType: typeof navigator !== 'undefined' && (navigator as any).connection != null,
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
  } catch {
    return 'unsupported';
  }
}
