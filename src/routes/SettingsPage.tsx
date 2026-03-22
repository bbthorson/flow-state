import { useNavigate } from 'react-router';
import { useAppStore } from '@/store/useAppStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Copy, Eye, EyeOff, ShieldCheck, X } from 'lucide-react';
import { VaultSection } from '@/components/vault-section';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import {
  ALL_PERMISSIONS,
  PERMISSION_LABELS,
  PERMISSION_DESCRIPTIONS,
  DevicePermission,
  PermissionState,
  isPromptable,
  requestPermission,
} from '@/lib/permissions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

function WebhookSecretSection() {
  const webhookSecret = useAppStore((state) => state.webhookSecret);
  const regenerateWebhookSecret = useAppStore((state) => state.regenerateWebhookSecret);
  const { toast } = useToast();
  const [visible, setVisible] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(webhookSecret);
    toast({ title: 'Copied', description: 'Webhook secret copied to clipboard.' });
  };

  const handleRegenerate = () => {
    regenerateWebhookSecret();
    setVisible(false);
    toast({ title: 'Secret Regenerated', description: 'Your webhook secret has been updated. Update any external services that use it.' });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Webhook Secret</CardTitle>
        <CardDescription>
          Used to authenticate deep link triggers. Share this with services that need to trigger your flows.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              readOnly
              value={visible ? webhookSecret : '••••••••••••••••'}
              className="pr-10 font-mono text-sm"
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full"
              onClick={() => setVisible(!visible)}
            >
              {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <Button variant="outline" size="icon" onClick={handleCopy} title="Copy to clipboard">
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm">
              <RefreshCw className="mr-2 h-3 w-3" />
              Regenerate
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Regenerate secret?</AlertDialogTitle>
              <AlertDialogDescription>
                This will invalidate the current secret. Any external services using it will stop working until updated.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleRegenerate}>Regenerate</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

function PermissionsSection() {
  const permissions = usePermissions();

  const handleGrant = async (perm: DevicePermission) => {
    await requestPermission(perm);
  };

  const statusColor = (state: PermissionState) => {
    switch (state) {
      case 'granted': return 'text-green-600 dark:text-green-400';
      case 'prompt': return 'text-yellow-600 dark:text-yellow-400';
      case 'denied': return 'text-red-600 dark:text-red-400';
      case 'unavailable': return 'text-muted-foreground';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          <CardTitle>Permissions</CardTitle>
        </div>
        <CardDescription>
          Browser capabilities used by your triggers and actions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {ALL_PERMISSIONS.map((perm) => {
          const state = permissions[perm];
          return (
            <div key={perm} className="flex items-center justify-between rounded-md border p-3">
              <div className="space-y-0.5 flex-1 mr-3">
                <div className="text-sm font-medium">{PERMISSION_LABELS[perm]}</div>
                <div className="text-xs text-muted-foreground">{PERMISSION_DESCRIPTIONS[perm]}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {state === 'prompt' && isPromptable(perm) && (
                  <Button variant="outline" size="sm" onClick={() => handleGrant(perm)}>
                    Grant
                  </Button>
                )}
                {state === 'denied' && (
                  <span className="text-[10px] text-muted-foreground">Check browser settings</span>
                )}
                <Badge variant="outline" className={`text-[10px] ${statusColor(state)}`}>
                  {state}
                </Badge>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function AboutSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>About</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <div className="flex justify-between">
          <span>Version</span>
          <span className="font-mono">0.2.0</span>
        </div>
        <div className="flex justify-between">
          <span>Storage</span>
          <span>Local only (IndexedDB)</span>
        </div>
        <p className="pt-2 text-xs">
          Flow State runs entirely on your device. No data is sent to any server unless you configure a webhook action.
        </p>
      </CardContent>
    </Card>
  );
}

export function SettingsPage() {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 px-4 py-2 backdrop-blur-[4px]">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">Settings</h1>
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <main className="flex-grow overflow-y-auto p-4">
        <div className="space-y-4">
          <WebhookSecretSection />
          <PermissionsSection />
          <VaultSection />
          <AboutSection />
        </div>
      </main>
    </div>
  );
}
