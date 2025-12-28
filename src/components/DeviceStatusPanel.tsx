'use client';

import React, { useEffect, useState } from 'react';
import { useDeviceStore } from '@/store/useDeviceStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Battery, Wifi, WifiOff, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getPermissionStatus } from '@/lib/device';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function DeviceStatusPanel() {
  const { battery, network, visibility } = useDeviceStore();
  const [permissions, setPermissions] = useState<Record<string, string>>({});

  useEffect(() => {
    const check = async () => {
      const geo = await getPermissionStatus('geolocation' as any);
      const notify = await getPermissionStatus('notifications' as any);
      setPermissions({ geolocation: geo, notifications: notify });
    };
    check();
  }, []);

  const deniedPermissions = Object.entries(permissions).filter(([_, status]) => status === 'denied');

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
      
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Battery</CardTitle>
            <Battery className={`h-4 w-4 ${battery.charging ? 'text-green-500 animate-pulse' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(battery.level * 100)}%</div>
            <p className="text-xs text-muted-foreground">
              {battery.charging ? 'Charging' : 'Discharging'}
              {!battery.supported && ' (Not Supported)'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Network</CardTitle>
            {network.online ? (
              <Wifi className="h-4 w-4 text-blue-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-destructive" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{network.online ? 'Online' : 'Offline'}</div>
            <p className="text-xs text-muted-foreground">
              Type: {network.type} ({network.effectiveType})
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Visibility</CardTitle>
            {visibility.state === 'visible' ? (
              <Eye className="h-4 w-4 text-primary" />
            ) : (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{visibility.state}</div>
            <Badge variant={visibility.state === 'visible' ? 'default' : 'secondary'} className="mt-1">
              {visibility.state === 'visible' ? 'Foreground' : 'Background'}
            </Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
