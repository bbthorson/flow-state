'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { AppHeader } from '@/components/app-bar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FlowList } from '@/components/flow-list';
import { HistoryList } from '@/components/history-list';
import { Library } from '@/components/library';
import { DeviceStatusPanel } from '@/components/DeviceStatusPanel';
import { VaultSection } from '@/components/vault-section';
import { useBatteryStatus } from '@/hooks/useBatteryStatus';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useVisibilityStatus } from '@/hooks/useVisibilityStatus';
import { useGeolocationStatus } from '@/hooks/useGeolocationStatus';
import { useFlowTriggerManager } from '@/hooks/useFlowTriggerManager';

export default function HomePage() {
  const initialized = useAppStore((state) => state.initialized);
  const processDeepLink = useAppStore((state) => state.processDeepLink);

  // Initialize triggers
  useBatteryStatus();
  useNetworkStatus();
  useVisibilityStatus();
  useGeolocationStatus();
  useFlowTriggerManager();

  // Deep Link Handler Effect
  useEffect(() => {
    // Only run on the client side after the component has mounted
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.toString().length > 0) {
        processDeepLink(params);
        // Clean the URL to prevent the trigger from firing again on reload
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
    // We only want this to run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render a loading state until the store is rehydrated from localStorage
  if (!initialized) {
    return <div>Loading...</div>; // Or a proper skeleton/loader component
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <AppHeader />
      <Tabs defaultValue="flows" className="flex flex-col flex-grow overflow-hidden">
        <main className="flex-grow overflow-y-auto p-4 pb-20">
          <TabsContent value="status" className="mt-0 h-full space-y-4">
            <DeviceStatusPanel />
            <VaultSection />
            <HistoryList />
          </TabsContent>

          <TabsContent value="flows" className="mt-0 h-full">
            <FlowList />
          </TabsContent>

          <TabsContent value="library" className="mt-0 h-full">
            <Library />
          </TabsContent>
        </main>

        <div className="border-t bg-background p-2">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="status">Status</TabsTrigger>
                <TabsTrigger value="flows">Flows</TabsTrigger>
                <TabsTrigger value="library">Library</TabsTrigger>
            </TabsList>
        </div>
      </Tabs>
    </div>
  );
}
