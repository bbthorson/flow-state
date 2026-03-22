import { useEffect } from 'react';
import { Outlet, NavLink, useSearchParams } from 'react-router';
import { useAppStore } from '@/store/useAppStore';
import { AppHeader } from '@/components/app-bar';
import { useBatteryStatus } from '@/hooks/useBatteryStatus';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useVisibilityStatus } from '@/hooks/useVisibilityStatus';
import { useGeolocationStatus } from '@/hooks/useGeolocationStatus';
import { useFlowTriggerManager } from '@/hooks/useFlowTriggerManager';
import { useIdleStatus } from '@/hooks/useIdleStatus';
import { useDeviceMotion } from '@/hooks/useDeviceMotion';
import { useScreenOrientation } from '@/hooks/useScreenOrientation';
import { useAuthStore } from '@/store/useAuthStore';

export function AppLayout() {
  const initialized = useAppStore((state) => state.initialized);
  const processDeepLink = useAppStore((state) => state.processDeepLink);
  const [searchParams, setSearchParams] = useSearchParams();
  const initAuth = useAuthStore((state) => state.init);

  // Initialize device monitors
  useBatteryStatus();
  useNetworkStatus();
  useVisibilityStatus();
  useGeolocationStatus();
  useIdleStatus();
  useDeviceMotion();
  useScreenOrientation();
  useFlowTriggerManager();

  // Initialize AT Protocol auth (restores session or handles OAuth callback)
  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Deep Link Handler
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
    <div className="flex flex-col h-dvh bg-background text-foreground">
      <AppHeader />
      <main className="flex-grow overflow-y-auto p-4 pb-20">
        <Outlet />
      </main>
      <nav className="border-t bg-background p-2">
        <div className="grid w-full grid-cols-3 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
          <NavLink
            to="/flows"
            className={({ isActive }) =>
              `inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                isActive ? 'bg-background text-foreground shadow-sm' : ''
              }`
            }
          >
            Flows
          </NavLink>
          <NavLink
            to="/activity"
            className={({ isActive }) =>
              `inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                isActive ? 'bg-background text-foreground shadow-sm' : ''
              }`
            }
          >
            Activity
          </NavLink>
          <NavLink
            to="/discover"
            className={({ isActive }) =>
              `inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                isActive ? 'bg-background text-foreground shadow-sm' : ''
              }`
            }
          >
            Discover
          </NavLink>
        </div>
      </nav>
    </div>
  );
}
