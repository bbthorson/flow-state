import { useAppStore } from '@/store/useAppStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Copy, Eye, EyeOff } from 'lucide-react';
import { VaultSection } from '@/components/vault-section';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
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
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">Manage your security, backups, and preferences.</p>
      </div>
      <WebhookSecretSection />
      <VaultSection />
      <AboutSection />
    </div>
  );
}
