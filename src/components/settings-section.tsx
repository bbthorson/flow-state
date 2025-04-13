'use client';

import {FormEvent} from 'react';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Button} from '@/components/ui/button';
import {sendWebhookNotification} from '@/services/webhook';
import {useToast} from '@/hooks/use-toast';

type SettingsSectionProps = {
  webhookUrl: string | null;
  setWebhookUrl: (url: string | null) => void;
};

export function SettingsSection({
  webhookUrl,
  setWebhookUrl,
}: SettingsSectionProps) {
  const {toast} = useToast();

  const handleSaveWebhook = async (e: FormEvent) => {
    e.preventDefault();
    if (webhookUrl !== null) {
      localStorage.setItem('webhookUrl', webhookUrl);
    }

    toast({
      description: 'Webhook URL saved successfully!',
    });

    // Simulate sending a test notification
    try {
      await sendWebhookNotification(webhookUrl || '', {
        message: 'Test notification from Do Not Disturb',
        timestamp: new Date().toISOString(),
      });

      toast({
        description: 'Test notification sent successfully!',
      });
    } catch (error) {
      toast({
        description: 'Failed to send test notification.',
      });
    }
  };

  return (
    <section className="w-full max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={handleSaveWebhook} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="webhookUrl">Webhook URL:</Label>
              <Input
                id="webhookUrl"
                type="url"
                placeholder="Enter webhook URL"
                value={webhookUrl || ''}
                onChange={e => setWebhookUrl(e.target.value)}
              />
            </div>
            <Button type="submit">Save Webhook URL</Button>
          </form>

          <div>
            <h3 className="text-lg font-semibold mb-2">API Access</h3>
            <p>
              This application requires access to the Battery Status API and
              Device Orientation API to function correctly. Please ensure these
              APIs are enabled in your browser settings.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Potential Triggers</h3>
            <ul>
              <li>Charging Status</li>
              <li>Screen Orientation</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
