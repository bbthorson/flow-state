'use client';

import {useEffect, useState} from 'react';
import {AppBar} from '@/components/app-bar';
import {StatusSection} from '@/components/status-section';
import {SettingsSection} from '@/components/settings-section';
import {Home, Settings} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';

export default function HomePage() {
  const [charging, setCharging] = useState<boolean | null>(null);
  const [faceDown, setFaceDown] = useState<boolean | null>(null);
  const [activeScreen, setActiveScreen] = useState<'status' | 'settings'>(
    'status'
  );

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
    <div className="flex min-h-screen flex-col bg-secondary">
      <AppBar />
      <main className="flex w-full flex-1 flex-col items-center p-4 md:p-8">
        {activeScreen === 'status' ? (
          <StatusSection charging={charging} faceDown={faceDown} />
        ) : (
          <SettingsSection />
        )}
      </main>

      <footer className="sticky bottom-0 w-full bg-muted p-4 text-foreground shadow-md">
        <div className="container mx-auto flex justify-around">
          <Button
            variant="ghost"
            onClick={() => setActiveScreen('status')}
            className={activeScreen === 'status' ? 'font-semibold text-green-500' : ''}
          >
            <Home className="mr-2 h-4 w-4" />
            Device Status
          </Button>
          <Button
            variant="ghost"
            onClick={() => setActiveScreen('settings')}
            className={activeScreen === 'settings' ? 'font-semibold text-green-500' : ''}
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </div>
      </footer>
    </div>
  );
}
