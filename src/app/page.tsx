'use client';
// src/app/page.tsx
import { useEffect, useState } from 'react';
import { useDeviceStatus } from '@/hooks/useDeviceStatus';
import { AppBar } from '@/components/app-bar';
import { StatusSection } from '@/components/status-section';
import { SettingsSection } from '@/components/settings-section';
import { Onboarding } from '@/components/onboarding';
import { Home, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/useAppStore'; // Import the store
import styles from './page.module.css'; // Import the CSS module

export default function HomePage() {
  const [showOnboarding, setShowOnboarding] = useState(false);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

  // Use the store
  const {
    charging,
    setCharging,
    faceDown,
    setFaceDown,
    activeScreen,
    setActiveScreen,
    lastSentTime,
    setLastSentTime,
    lastStatus,
    setLastStatus,
    webhooks,
    setWebhooks,
  } = useAppStore();

  useDeviceStatus();

  return (
    <div className={styles.container}>
      {showOnboarding && <Onboarding onComplete={handleOnboardingComplete} />}
      <AppBar activeScreen={activeScreen} setActiveScreen={setActiveScreen} />
      <main className={styles.main}>
        {activeScreen === 'status' ? (
          <StatusSection
            charging={charging}
            faceDown={faceDown}
            lastSentTime={lastSentTime}
            lastStatus={lastStatus}
          />
        ) : (
          <SettingsSection
            onWebhookSent={async (success: boolean, url: string) => {
              console.log("webhook sent with", success);
              setLastSentTime(new Date());
              if (success) {
                setLastStatus("Sent successfully");
              } else {
                setLastStatus("Failed");
              }
            }}
          />
        )}
      </main>
    </div>
  );
}
