'use client';

import {useEffect, useState} from 'react';
import {AppBar} from '@/components/app-bar';
import {StatusSection} from '@/components/status-section';
import {WebhookSection} from '@/components/webhook-section';

export default function Home() {
  const [charging, setCharging] = useState<boolean | null>(null);
  const [faceDown, setFaceDown] = useState<boolean | null>(null);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);

  useEffect(() => {
    // Load webhook URL from localStorage
    const storedWebhookUrl = localStorage.getItem('webhookUrl');
    if (storedWebhookUrl) {
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
        <StatusSection charging={charging} faceDown={faceDown} />
        <WebhookSection
          setWebhookUrl={setWebhookUrl}
          webhookUrl={webhookUrl}
        />
      </main>
    </div>
  );
}
