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
import { CalendarDays, Zap, Activity, Compass } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/timeline', label: 'Timeline', Icon: CalendarDays },
  { to: '/flows', label: 'Flows', Icon: Zap },
  { to: '/activity', label: 'Activity', Icon: Activity },
  { to: '/discover', label: 'Discover', Icon: Compass },
];

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
    <div className="flex flex-col h-dvh bg-background text-foreground">
      <AppHeader />
      <main className="flex-grow overflow-y-auto p-4 pb-20">
        <Outlet />
      </main>
      <nav className="border-t bg-background">
        <div className="flex items-center justify-around py-1">
          {NAV_ITEMS.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-4 py-2 rounded-md transition-colors ${
                  isActive
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.5]'}`} />
                  <span className="text-[10px] font-medium">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
