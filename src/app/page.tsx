'use client';

import {useEffect, useState} from 'react';
import {AppBar} from '@/components/app-bar';
import {StatusSection} from '@/components/status-section';
import {SettingsSection} from '@/components/settings-section';
import {Home, Settings} from 'lucide-react';
import {Button} from '@/components/ui/button';

export default function HomePage() {
  const [charging, setCharging] = useState<boolean | null>(null);
  const [faceDown, setFaceDown] = useState<boolean | null>(null);
  const [activeScreen, setActiveScreen] = useState<'status' | 'settings'>(
    'status'
  );
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);

  useEffect(() => {
    // Load webhook URL from localStorage on the client-side
    const storedWebhookUrl = localStorage.getItem('webhookUrl');
    if (typeof window !== 'undefined') {
      setWebhookUrl(storedWebhookUrl);
    }

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
      <AppBar />
      <main className="flex w-full flex-1 flex-col items-center p-4 md:p-8">
        {activeScreen === 'status' && (
          <StatusSection charging={charging} faceDown={faceDown} />
        )}
        {activeScreen === 'settings' && (
          <SettingsSection
            webhookUrl={webhookUrl}
            setWebhookUrl={setWebhookUrl}
          />
        )}
      </main>

      <footer className="flex w-full justify-around border-t p-4">
        <Button
          variant="ghost"
          onClick={() => setActiveScreen('status')}
          className={activeScreen === 'status' ? 'bg-accent' : ''}
        >
          <Home className="mr-2 h-4 w-4" />
          Device Status
        </Button>
        <Button
          variant="ghost"
          onClick={() => setActiveScreen('settings')}
          className={activeScreen === 'settings' ? 'bg-accent' : ''}
        >
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </Button>
      </footer>
    </div>
  );
}
