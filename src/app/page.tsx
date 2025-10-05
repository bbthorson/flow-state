'use client';
// src/app/page.tsx
import { useEffect, useState } from 'react';
import { useDeviceStatus } from '@/hooks/useDeviceStatus';
import { AppBar } from '@/components/app-bar';
import { StatusSection } from '@/components/status-section';
import { SettingsSection } from '@/components/settings-section';
import { Onboarding } from '@/components/onboarding';
import { useAppStore } from '@/store/useAppStore'; // Import the store
import styles from './page.module.css'; // Import the CSS module
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';

export default function HomePage() {
  const [showOnboarding, setShowOnboarding] = useState(false);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

  // Use the store
  const {
    charging,
    faceDown,
    lastSentTime,
    setLastSentTime,
    lastStatus,
    setLastStatus,
  } = useAppStore();

  useDeviceStatus();

  return (
    <div className={styles.container}>
      {showOnboarding && <Onboarding onComplete={handleOnboardingComplete} />}
      <AppBar>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost">
              <Settings className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Settings</SheetTitle>
            </SheetHeader>
            <SettingsSection
              onWebhookSent={async (success: boolean, url: string) => {
                console.log('webhook sent with', success);
                setLastSentTime(new Date());
                if (success) {
                  setLastStatus('Sent successfully');
                } else {
                  setLastStatus('Failed');
                }
              }}
            />
          </SheetContent>
        </Sheet>
      </AppBar>
      <main className={styles.main}>
        <StatusSection
          charging={charging}
          faceDown={faceDown}
          lastSentTime={lastSentTime}
          lastStatus={lastStatus}
        />
      </main>
    </div>
  );
}
