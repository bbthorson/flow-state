import React, { useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/components/ui/button';
import { Download, Upload, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { backupStatus, describeBackupAge } from '@/lib/vault';
import { cn } from '@/lib/utils';

export function VaultSection() {
  const { exportVault, importVault } = useAppStore();
  const lastBackupTimestamp = useAppStore((state) => state.lastBackupTimestamp);
  const status = backupStatus(lastBackupTimestamp);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleExport = () => {
    try {
      const data = exportVault();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flow-state-vault-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: 'Vault Exported',
        description: 'Your configuration has been downloaded successfully.',
      });
    } catch {
      toast({
        title: 'Export Failed',
        description: 'An error occurred while exporting your vault.',
        variant: 'destructive',
      });
    }
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const result = importVault(content);
        
        if (result.success) {
          toast({
            title: 'Vault Imported',
            description: result.message,
          });
        } else {
          toast({
            title: 'Import Failed',
            description: result.message,
            variant: 'destructive',
          });
        }
      } catch {
        toast({
          title: 'Import Error',
          description: 'The selected file is not a valid vault format.',
          variant: 'destructive',
        });
      }
    };
    reader.readAsText(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const needsAttention = status.state !== 'fresh';

  return (
    <div className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold">Vault</h3>
        <p className="text-xs text-muted-foreground">
          Export or import your local configuration. Your data never leaves your device.
        </p>
      </div>

      {/* Browsers evict storage for sites you haven't opened in a week, and this
          is the only copy that survives that. */}
      <div
        className={cn(
          'flex items-start gap-2 rounded-md border p-2.5 text-xs',
          needsAttention ? 'border-destructive/40 text-destructive' : 'text-muted-foreground',
        )}
      >
        {needsAttention ? (
          <ShieldAlert aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" />
        ) : (
          <ShieldCheck aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" />
        )}
        <span>
          {status.state === 'none' && 'No backup yet. Export one so your flows survive a cleared cache.'}
          {status.state === 'stale' &&
            `Last backup ${describeBackupAge(status.daysAgo)}. Export a fresh one — browsers can clear site data after about a week.`}
          {status.state === 'fresh' && `Last backup ${describeBackupAge(status.daysAgo)}.`}
        </span>
      </div>
      <div className="flex gap-2">
        <Button onClick={handleExport} className="flex-1" variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
        <div className="relative flex-1">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImport}
            accept=".json"
            className="hidden"
          />
          <Button onClick={() => fileInputRef.current?.click()} className="w-full" variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
        </div>
      </div>
    </div>
  );
}