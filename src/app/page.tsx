'use client';

import {useEffect, useState} from 'react';
import {AppBar} from '@/components/app-bar';
import {StatusSection} from '@/components/status-section';
import {SettingsSection} from '@/components/settings-section';
import {Settings, Plus} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';

export default function HomePage() {
  const [charging, setCharging] = useState<boolean | null>(null);
  const [faceDown, setFaceDown] = useState<boolean | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    // Battery Status API
    if ('getBattery' in navigator) {
      navigator.getBattery().then(battery => {
        setCharging(battery.charging);

        battery.addEventListener('chargingchange', () => {
          setCharging(battery.charging);
        });
      });
    } else {
      console.log('Battery Status API not supported.');
    }

    // Device Orientation API
    if ('DeviceOrientationEvent' in window) {
      const handleOrientation = (event: DeviceOrientationEvent) => {
        if (event.beta && event.gamma) {
          const isFaceDown =
            Math.abs(event.beta) >= 90 || Math.abs(event.gamma) >= 90;
          setFaceDown(isFaceDown);
        }
      };

      window.addEventListener('deviceorientation', handleOrientation);

      return () => {
        window.removeEventListener('deviceorientation', handleOrientation);
      };
    } else {
      console.log('Device Orientation API not supported.');
    }
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center bg-secondary">
      <AppBar>
        <Button
          variant="ghost"
          onClick={() => setIsSettingsOpen(true)}
          className="absolute right-4 top-1/2 -translate-y-1/2"
        >
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </Button>
      </AppBar>
      <main className="flex w-full flex-1 flex-col items-center p-4 md:p-8">
        <Card>
          <CardHeader>
            <CardTitle>About Flow State</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              This application uses phone status indicators to send a webhook to
              the URL of your choice. The intention is that you can use that
              webhook to programmatically update your other services to pause or
              unpause notifications.
            </p>
          </CardContent>
        </Card>

        <StatusSection charging={charging} faceDown={faceDown} />

        <Button variant="outline" className="mt-4">
          Add Webhook Trigger
          <Plus className="ml-2 h-4 w-4" />
        </Button>
      </main>

      <SettingsSection
        open={isSettingsOpen}
        setOpen={setIsSettingsOpen}
      />
    </div>
  );
}

