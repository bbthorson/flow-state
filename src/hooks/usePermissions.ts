import { useState, useEffect, useCallback } from 'react';
import {
  DevicePermission,
  PermissionState,
  checkAllPermissions,
} from '@/lib/permissions';

type PermissionMap = Record<DevicePermission, PermissionState>;

const INITIAL: PermissionMap = {
  'battery-status': 'unavailable',
  'network-information': 'unavailable',
  geolocation: 'unavailable',
  notifications: 'unavailable',
};

/**
 * Reactive hook that returns the current state of all device permissions.
 * Re-checks when the page becomes visible (user may grant in browser settings).
 */
export function usePermissions(): PermissionMap {
  const [permissions, setPermissions] = useState<PermissionMap>(INITIAL);

  const refresh = useCallback(async () => {
    const result = await checkAllPermissions();
    setPermissions(result);
  }, []);

  useEffect(() => {
    refresh();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [refresh]);

  return permissions;
}
