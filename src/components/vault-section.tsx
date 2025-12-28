'use client';

import React, { useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Upload, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function VaultSection() {
  const { exportVault, importVault } = useAppStore();
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
    } catch (error) {
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
      } catch (error) {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vault Management</CardTitle>
        <CardDescription>
          Export or import your local configuration. Your data never leaves your device.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex gap-2">
          <Button onClick={handleExport} className="flex-1" variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Vault
          </Button>
          
          <div className="relative flex-1">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImport}
              accept=".json"
              className="hidden"
            />
            <Button onClick={() => fileInputRef.current?.click()} className="w-full">
              <Upload className="mr-2 h-4 w-4" />
              Import Vault
            </Button>
          </div>
        </div>
        
        <p className="text-xs text-muted-foreground italic">
          Tip: Download a backup regularly to prevent data loss if you clear your browser cache.
        </p>
      </CardContent>
    </Card>
  );
}