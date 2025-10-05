'use client';
// src/app/page.tsx
import { useEffect, useState } from 'react';
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

  return (
    <div className={styles.container}>
      {showOnboarding && <Onboarding onComplete={handleOnboardingComplete} />}
      <AppBar />
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

      <footer className="sticky bottom-0 w-full bg-muted p-4 text-foreground shadow-md">
        <div className="container mx-auto flex justify-around">
          <Button
            variant="ghost"
            onClick={() => setActiveScreen('status')}
            className={activeScreen === 'status' ? 'text-primary font-bold' : ''}
          >
            <Home className="mr-2 h-4 w-4" />
            Device Status
          </Button>
          <Button
            variant="ghost"
            onClick={() => setActiveScreen('settings')}
            className={activeScreen === 'settings' ? 'text-primary font-bold' : ''}
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </div>
      </footer>
    </div>
  );
}
