'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { AppHeader } from '@/components/app-bar'; // Using a simplified AppHeader
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FlowList } from '@/components/flow-list'; // Placeholder for now
import { HistoryList } from '@/components/history-list'; // Placeholder for now
import { Library } from '@/components/library'; // Placeholder for now

export default function HomePage() {
  const { initialized, processDeepLink } = useAppStore((state) => ({
    initialized: state.initialized,
    processDeepLink: state.processDeepLink,
  }));

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
          
          import { FlowList } from '@/components/flow-list';
...
          <TabsContent value="flows">
            <FlowList />
          </TabsContent>
...
          
          import { HistoryList } from '@/components/history-list';
...
          <TabsContent value="history">
            <HistoryList />
          </TabsContent>
...

          import { Library } from '@/components/library';
...
          <TabsContent value="library">
            <Library />
          </TabsContent>
...
        </Tabs>
      </main>
    </div>
  );
}