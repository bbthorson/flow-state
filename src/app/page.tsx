'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { AppHeader } from '@/components/app-bar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FlowList } from '@/components/flow-list';
import { HistoryList } from '@/components/history-list';
import { Library } from '@/components/library';

export default function HomePage() {
  const initialized = useAppStore((state) => state.initialized);
  const processDeepLink = useAppStore((state) => state.processDeepLink);

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
      <main className="flex-grow p-4">
        <Tabs defaultValue="flows" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="flows">Flows</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="library">Library</TabsTrigger>
          </TabsList>
          
          <TabsContent value="flows">
            <FlowList />
          </TabsContent>
          
          <TabsContent value="history">
            <HistoryList />
          </TabsContent>

          <TabsContent value="library">
            <Library />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
