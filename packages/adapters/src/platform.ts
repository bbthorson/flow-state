export type PlatformKind = 'android' | 'ios' | 'desktop';

export interface CapabilitySupport {
  id: string;
  label: string;
  supported: boolean;
  note?: string;
}

export interface PlatformReport {
  platform: PlatformKind;
  capabilities: CapabilitySupport[];
}

export function detectPlatform(ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''): PlatformKind {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

/**
 * Transparently report which browser capabilities work natively on this device
 * vs. require an Apple Shortcut deep-link or the optional Hub.
 */
export function probePlatformCapabilities(): PlatformReport {
  const platform = detectPlatform();
  const hasNav = typeof navigator !== 'undefined';

  return {
    platform,
    capabilities: [
      {
        id: 'device.battery',
        label: 'Battery Sensor',
        supported: hasNav && typeof (navigator as any).getBattery === 'function',
        note: platform === 'ios' ? 'Use Apple Shortcuts → Deep Link on iOS' : 'Foreground only',
      },
      {
        id: 'device.network',
        label: 'Network Status',
        supported: hasNav && 'onLine' in navigator,
      },
      {
        id: 'device.geolocation',
        label: 'Geolocation',
        supported: hasNav && 'geolocation' in navigator,
        note: 'Foreground only; use Shortcuts/Hub for background geofencing',
      },
      {
        id: 'local.notification',
        label: 'Notifications',
        supported: typeof Notification !== 'undefined',
        note: platform === 'ios' ? 'Requires installing PWA to Home Screen (iOS 16.4+)' : undefined,
      },
      {
        id: 'local.clipboard',
        label: 'Clipboard',
        supported: hasNav && Boolean(navigator.clipboard),
      },
      {
        id: 'local.webhook',
        label: 'Webhooks',
        supported: typeof fetch === 'function',
      },
    ],
  };
}
