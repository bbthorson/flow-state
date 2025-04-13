import {ChangeEvent, FormEvent, useEffect, useState} from 'react';
import {Button} from '@/components/ui/button';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {sendWebhookNotification} from '@/services/webhook';
import {useToast} from '@/hooks/use-toast';

type WebhookSectionProps = {
  webhookUrl: string | null;
  setWebhookUrl: (url: string | null) => void;
};

export function WebhookSection({
  webhookUrl,
  setWebhookUrl,
}: WebhookSectionProps) {
  const [inputUrl, setInputUrl] = useState(webhookUrl || '');
  const {toast} = useToast();

  useEffect(() => {
    // Load webhook URL from localStorage
    const storedWebhookUrl = localStorage.getItem('webhookUrl');
    if (storedWebhookUrl) {
      setInputUrl(storedWebhookUrl);
    }
  }, []);

  const handleUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
    setInputUrl(e.target.value);
  };

  const handleSaveWebhook = async (e: FormEvent) => {
    e.preventDefault();
    localStorage.setItem('webhookUrl', inputUrl);
    setWebhookUrl(inputUrl);

    toast({
      description: 'Webhook URL saved successfully!',
    });

    // Simulate sending a test notification
    try {
      await sendWebhookNotification(inputUrl, {
        message: 'Test notification from PWA State Tracker',
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
          <CardTitle>Webhook Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveWebhook} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="webhookUrl">Webhook URL:</Label>
              <Input
                id="webhookUrl"
                type="url"
                placeholder="Enter webhook URL"
                value={inputUrl}
                onChange={handleUrlChange}
              />
            </div>
            <Button type="submit">Save Webhook URL</Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
