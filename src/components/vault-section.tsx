'use client';

import { useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Label } from './ui/label';

function formatTimeAgo(timestamp: number | null): string {
    if (timestamp === null) {
      return 'No backup has been created yet.';
    }
  
    const now = Date.now();
    const seconds = Math.floor((now - timestamp) / 1000);
  
    if (seconds < 60) {
      return `Last backup: just now`;
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return `Last backup: ${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `Last backup: ${hours} hour${hours > 1 ? 's' : ''} ago`;
    }
    const days = Math.floor(hours / 24);
    return `Last backup: ${days} day${days > 1 ? 's' : ''} ago`;
}

export function VaultSection() {
  const exportVault = useAppStore(state => state.exportVault);
  const importVault = useAppStore(state => state.importVault);
  const lastBackupTimestamp = useAppStore(state => state.lastBackupTimestamp);

  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const vaultJson = exportVault();
    const blob = new Blob([vaultJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `flow-state-vault-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: 'Vault Exported',
      description: 'Your configuration has been downloaded.',
    });
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const json = e.target?.result as string;
      const { success, message } = importVault(json);
      if (success) {
        toast({
          title: 'Vault Imported',
          description: message,
        });
      } else {
        toast({
          title: 'Import Failed',
          description: message,
          variant: 'destructive',
        });
      }
      // Reset file input
      if(fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col gap-4 mt-4">
        <p className="text-sm text-muted-foreground">
            {formatTimeAgo(lastBackupTimestamp)}
        </p>
        <div className="grid grid-cols-2 gap-2">
            <Button onClick={handleExport}>Download Backup</Button>
            <Label htmlFor="import-vault" className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
                Import Backup
            </Label>
            <Input
                id="import-vault"
                type="file"
                accept=".json"
                ref={fileInputRef}
                className="hidden"
                onChange={handleImport}
                />
        </div>
        <p className="text-xs text-muted-foreground pt-4">
            Your data is only stored in this browser. To prevent data loss from browser cache clearing (common on iOS), you should create regular backups.
        </p>
    </div>
  );
}
