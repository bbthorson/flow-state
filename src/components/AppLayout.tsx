import { Suspense, useEffect } from 'react';
import { Outlet, useSearchParams } from 'react-router';
import { useAppStore } from '@/store/useAppStore';
import { useBatteryStatus } from '@/hooks/useBatteryStatus';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useVisibilityStatus } from '@/hooks/useVisibilityStatus';
import { useGeolocationStatus } from '@/hooks/useGeolocationStatus';
import { useFlowTriggerManager } from '@/hooks/useFlowTriggerManager';
import { useIdleStatus } from '@/hooks/useIdleStatus';
import { useDeviceMotion } from '@/hooks/useDeviceMotion';
import { useScreenOrientation } from '@/hooks/useScreenOrientation';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * Persistent app shell. Mounts device sensor hooks and auth once and keeps
 * them alive across navigation — secondary routes render in the Outlet
 * without remounting this layer.
 */
export function AppLayout() {
  const initialized = useAppStore((state) => state.initialized);
  const processDeepLink = useAppStore((state) => state.processDeepLink);
  const [searchParams, setSearchParams] = useSearchParams();
  const initAuth = useAuthStore((state) => state.init);

  useBatteryStatus();
  useNetworkStatus();
  useVisibilityStatus();
  useGeolocationStatus();
  useIdleStatus();
  useDeviceMotion();
  useScreenOrientation();
  useFlowTriggerManager();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    if (searchParams.toString().length > 0) {
      processDeepLink(searchParams);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!initialized) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <Suspense fallback={<div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Loading…</div>}>
        <Outlet />
      </Suspense>
    </div>
  );
}
