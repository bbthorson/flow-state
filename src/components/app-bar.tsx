'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import { SyncStatusIcon } from '@/components/sync-status-icon';
import { VaultSection } from '@/components/vault-section';

export function AppHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 p-2 backdrop-blur-[4px]">
      <div className="container mx-auto flex items-center justify-between">
        <h1 className="text-xl font-bold">Flow State</h1>

        <div className="flex items-center gap-2">
          <SyncStatusIcon />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Settings & Vault</SheetTitle>
              </SheetHeader>
              <VaultSection />
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
