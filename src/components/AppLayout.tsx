import { useEffect } from 'react';
import { Outlet, NavLink, useSearchParams } from 'react-router';
import { useAppStore } from '@/store/useAppStore';
import { AppHeader } from '@/components/app-bar';
import { useBatteryStatus } from '@/hooks/useBatteryStatus';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useVisibilityStatus } from '@/hooks/useVisibilityStatus';
import { useGeolocationStatus } from '@/hooks/useGeolocationStatus';
import { useFlowTriggerManager } from '@/hooks/useFlowTriggerManager';

export function AppLayout() {
  const initialized = useAppStore((state) => state.initialized);
  const processDeepLink = useAppStore((state) => state.processDeepLink);
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize device monitors
  useBatteryStatus();
  useNetworkStatus();
  useVisibilityStatus();
  useGeolocationStatus();
  useFlowTriggerManager();

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
    <div className="flex flex-col h-screen bg-background text-foreground">
      <AppHeader />
      <main className="flex-grow overflow-y-auto p-4 pb-20">
        <Outlet />
      </main>
      <nav className="border-t bg-background p-2">
        <div className="grid w-full grid-cols-3 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
          <NavLink
            to="/status"
            className={({ isActive }) =>
              `inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                isActive ? 'bg-background text-foreground shadow-sm' : ''
              }`
            }
          >
            Status
          </NavLink>
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
            to="/library"
            className={({ isActive }) =>
              `inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                isActive ? 'bg-background text-foreground shadow-sm' : ''
              }`
            }
          >
            Library
          </NavLink>
        </div>
      </nav>
    </div>
  );
}
