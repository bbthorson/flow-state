import { useEffect, useMemo, useState } from 'react';
import { useDeviceStore } from '@/store/useDeviceStore';
import { Battery, BatteryCharging, Wifi, WifiOff, AlertTriangle, type LucideIcon } from 'lucide-react';
import { getPermissionStatus, getSupportedTriggers, type PermissionNameWithExtra } from '@/lib/device';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import type { NetworkState } from '@/types/device';

type StatProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  detail?: string;
  /** Dims the whole chip — used when the browser can't report this at all. */
  muted?: boolean;
  iconClassName?: string;
};

function Stat({ icon: Icon, label, value, detail, muted, iconClassName }: StatProps) {
  return (
    <div className={cn('flex items-center gap-2.5 rounded-md border p-2.5', muted && 'opacity-60')}>
      <Icon aria-hidden="true" className={cn('h-4 w-4 shrink-0 text-muted-foreground', iconClassName)} />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
        {detail && <p className="truncate text-[10px] text-muted-foreground">{detail}</p>}
      </div>
    </div>
  );
}

/** A connection field is only worth printing if it actually says something. */
function meaningful(value?: string): string | undefined {
  return value && value !== 'unknown' && value !== 'none' ? value : undefined;
}

function networkDetail(network: NetworkState, canReportType: boolean): string | undefined {
  // "Offline" already says everything; a type subtitle would only muddy it.
  if (!network.online) return undefined;
  if (!canReportType) return 'Type unavailable';
  if (!network.supported) return 'Checking…';
  // Chromium and Android Chrome populate effectiveType ('4g') but leave type
  // undefined, so preferring type alone would print "Type: unknown" for most of
  // this app's users.
  const label = meaningful(network.type) ?? meaningful(network.effectiveType);
  return label ? `Type: ${label}` : 'Type unavailable';
}

export function DeviceStatusPanel() {
  const battery = useDeviceStore((state) => state.battery);
  const network = useDeviceStore((state) => state.network);
  const [permissions, setPermissions] = useState<Record<string, string>>({});
  // What the device *can* report, known synchronously.
  const can = useMemo(() => getSupportedTriggers(), []);

  useEffect(() => {
    const check = async () => {
      const names: PermissionNameWithExtra[] = ['geolocation', 'notifications'];
      const [geo, notify] = await Promise.all(names.map(getPermissionStatus));
      setPermissions({ geolocation: geo, notifications: notify });
    };
    check();
  }, []);

  const deniedPermissions = Object.entries(permissions).filter(([, status]) => status === 'denied');

  return (
    <div className="space-y-4">
      {deniedPermissions.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Permissions Required</AlertTitle>
          <AlertDescription>
            Some features are disabled because permissions were denied ({deniedPermissions.map(([p]) => p).join(', ')}).
            Please enable them in your browser settings to use all automations.
          </AlertDescription>
        </Alert>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Device</h3>
        <div className="grid grid-cols-2 gap-2">
          {/* Three distinct states. Without the Battery API the store still holds
              its defaults (100%, discharging), so reporting them would invent a
              reading — but the device's own reading is debounced, so "no reading
              yet" must not be reported as "no battery API" either. */}
          {!can.battery ? (
            <Stat icon={Battery} label="Battery" value="Unavailable" detail="No Battery API here" muted />
          ) : battery.supported ? (
            <Stat
              icon={battery.charging ? BatteryCharging : Battery}
              iconClassName={battery.charging ? 'text-green-600' : undefined}
              label="Battery"
              value={`${Math.round(battery.level * 100)}%`}
              detail={battery.charging ? 'Charging' : 'Discharging'}
            />
          ) : (
            <Stat icon={Battery} label="Battery" value="Checking…" muted />
          )}

          {/* online/offline comes from navigator.onLine and is always truthful;
              only the connection type depends on the Network Information API. */}
          <Stat
            icon={network.online ? Wifi : WifiOff}
            iconClassName={network.online ? 'text-blue-600' : 'text-destructive'}
            label="Network"
            value={network.online ? 'Online' : 'Offline'}
            detail={networkDetail(network, can.connectionType)}
          />
        </div>
      </section>
    </div>
  );
}
