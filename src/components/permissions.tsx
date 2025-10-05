
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type PermissionStatus = 'Granted' | 'Denied' | 'Prompt' | 'Not Available';

export function Permissions() {
  const [batteryStatus, setBatteryStatus] = useState<PermissionStatus>('Not Available');
  const [orientationStatus, setOrientationStatus] = useState<PermissionStatus>('Not Available');

  useEffect(() => {
    // Check for Battery API
    if ('getBattery' in navigator) {
      setBatteryStatus('Granted'); // Assumed granted as there is no prompt
    } else {
      setBatteryStatus('Not Available');
    }

    // Check for Device Orientation API
    if ('DeviceOrientationEvent' in window) {
      // @ts-ignore
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        // @ts-ignore
        DeviceOrientationEvent.requestPermission()
          .then(permissionState => {
            if (permissionState === 'granted') {
              setOrientationStatus('Granted');
            } else {
              setOrientationStatus('Denied');
            }
          })
          .catch(() => {
            setOrientationStatus('Prompt');
          });
      } else {
        // Assume granted for browsers that don't require explicit permission
        setOrientationStatus('Granted');
      }
    } else {
      setOrientationStatus('Not Available');
    }
  }, []);

  const handleRequestOrientationPermission = () => {
    // @ts-ignore
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      // @ts-ignore
      DeviceOrientationEvent.requestPermission()
        .then(permissionState => {
          if (permissionState === 'granted') {
            setOrientationStatus('Granted');
          } else {
            setOrientationStatus('Denied');
          }
        })
        .catch(console.error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Permissions</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold">Battery Status</h4>
            <p className="text-sm text-muted-foreground">Used to detect if your device is charging.</p>
          </div>
          <span className={`text-sm font-semibold ${batteryStatus === 'Granted' ? 'text-green-500' : 'text-red-500'}`}>
            {batteryStatus}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold">Device Orientation</h4>
            <p className="text-sm text-muted-foreground">Used to detect if your device is face down.</p>
          </div>
          {orientationStatus === 'Prompt' && (
            <Button onClick={handleRequestOrientationPermission}>Grant Permission</Button>
          )}
          {orientationStatus !== 'Prompt' && (
            <span className={`text-sm font-semibold ${orientationStatus === 'Granted' ? 'text-green-500' : 'text-red-500'}`}>
              {orientationStatus}
            </span>
          )}
        </div>
        {orientationStatus === 'Denied' && (
            <p className="text-sm text-red-500">Permission was denied. You may need to grant it manually in your browser settings.</p>
        )}
      </CardContent>
    </Card>
  );
}
