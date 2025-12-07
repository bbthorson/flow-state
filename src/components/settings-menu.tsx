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
import { SettingsSection } from '@/components/settings-section';

export function SettingsMenu() {
  const handleWebhookSent = (success: boolean, url?: string) => {
    // This function satisfies the SettingsSection props,
    // although the toast logic is mostly handled inside SettingsSection or could be handled here if needed.
    // Based on SettingsSection implementation, it displays a toast on error, but we can add one for success here if we want.
    // For now, I'll leave it simple.
    console.log(`Webhook sent: ${success}, url: ${url}`);
  };

  return (
    <div className="flex items-center gap-2">
      <SyncStatusIcon />
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Settings & Vault</SheetTitle>
          </SheetHeader>
          <div className="space-y-6 mt-4">
            <SettingsSection onWebhookSent={handleWebhookSent} />
            <VaultSection />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
