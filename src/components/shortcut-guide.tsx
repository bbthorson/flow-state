'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Check, RefreshCw, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function ShortcutGuide() {
  const { webhookSecret, regenerateWebhookSecret } = useAppStore();
  const [baseUrl, setBaseUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin + window.location.pathname);
    }
  }, []);

  const triggerUrl = `${baseUrl}?secret=${webhookSecret}&event=SHORTCUT`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(triggerUrl);
    setCopied(true);
    toast({
      title: "Copied to clipboard",
      description: "The trigger URL has been copied to your clipboard.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Connect to iOS Shortcuts
        </CardTitle>
        <CardDescription>
          Trigger Flow State automations from iOS Shortcuts, Siri, or Widgets.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="trigger-url">Your Trigger URL</Label>
          <div className="flex gap-2">
            <Input
              id="trigger-url"
              readOnly
              value={triggerUrl}
              className="font-mono text-xs"
            />
            <Button size="icon" variant="outline" onClick={copyToClipboard}>
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="outline" onClick={regenerateWebhookSecret} title="Regenerate Secret">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            This URL uses a secret key to identify you. Keep it private.
          </p>
        </div>

        <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
          <h4 className="text-sm font-semibold">How to setup:</h4>
          <ol className="text-xs space-y-2 list-decimal list-inside text-muted-foreground">
            <li>Open the <strong>Shortcuts</strong> app on your iPhone.</li>
            <li>Add a <strong>&quot;Get Contents of URL&quot;</strong> action.</li>
            <li>Paste your Trigger URL into the URL field.</li>
            <li>(Optional) Add a <strong>&quot;payload&quot;</strong> parameter to pass data.</li>
          </ol>
          <div className="pt-2">
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
                <a href="https://support.apple.com/guide/shortcuts/welcome/ios" target="_blank" rel="noreferrer">
                    Shortcuts User Guide <ExternalLink className="ml-1 h-3 w-3" />
                </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
