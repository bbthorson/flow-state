'use client';

import {FormEvent, useState, useEffect} from 'react';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Button} from '@/components/ui/button';
import {sendWebhookNotification} from '@/services/webhook';
import {useToast} from '@/hooks/use-toast';
import {Checkbox} from '@/components/ui/checkbox';
import {Dialog, DialogContent, DialogHeader, DialogTitle} from '@/components/ui/dialog';

type WebhookConfig = {
  id: string;
  url: string;
  charging: boolean;
  orientation: boolean;
};

type SettingsSectionProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

export function SettingsSection({open, setOpen}: SettingsSectionProps) {
  const {toast} = useToast();
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([
    {
      id: 'default',
      url: '',
      charging: true,
      orientation: true,
    },
  ]);

  useEffect(() => {
    // Load webhook configurations from localStorage
    const storedWebhooks = localStorage.getItem('webhooks');
    if (storedWebhooks) {
      setWebhooks(JSON.parse(storedWebhooks));
    }
  }, []);

  useEffect(() => {
    // Save webhook configurations to localStorage
    localStorage.setItem('webhooks', JSON.stringify(webhooks));
  }, [webhooks]);

  const handleWebhookChange = (
    id: string,
    field: string,
    value: string | boolean
  ) => {
    setWebhooks(prevWebhooks =>
      prevWebhooks.map(webhook =>
        webhook.id === id ? {...webhook, [field]: value} : webhook
      )
    );
  };

  const handleSaveWebhook = async (e: FormEvent) => {
    e.preventDefault();

    localStorage.setItem('webhooks', JSON.stringify(webhooks));

    toast({
      description: 'Webhook configurations saved successfully!',
    });

    // Simulate sending a test notification for each webhook
    webhooks.forEach(async webhook => {
      try {
        await sendWebhookNotification(webhook.url || '', {
          message: 'Test notification from Do Not Disturb',
          timestamp: new Date().toISOString(),
          trigger: {
            charging: webhook.charging,
            orientation: webhook.orientation,
          },
        });

        toast({
          description: `Test notification sent successfully for webhook ${webhook.id}!`,
        });
      } catch (error) {
        toast({
          description: `Failed to send test notification for webhook ${webhook.id}.`,
        });
      }
    });
  };

  const handleAddWebhook = () => {
    const newId = Math.random().toString(36).substring(7);
    setWebhooks([
      ...webhooks,
      {id: newId, url: '', charging: false, orientation: false},
    ]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <section className="w-full max-w-md flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>API Access</CardTitle>
            </CardHeader>
            <CardContent>
              <p>
                This application requires access to the Battery Status API and
                Device Orientation API to function correctly. Please ensure these
                APIs are enabled in your browser settings.
              </p>
            </CardContent>
            <CardContent>
              <h3 className="text-lg font-semibold mb-2">Potential Triggers</h3>
              <ul>
                <li>Charging Status</li>
                <li>Screen Orientation</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Webhook Configuration</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <form onSubmit={handleSaveWebhook} className="flex flex-col gap-4">
                {webhooks.map(webhook => (
                  <div key={webhook.id} className="flex flex-col gap-2 border p-4 rounded-md">
                    <h4 className="text-sm font-semibold">Webhook {webhook.id === 'default' ? '(Default)' : ''}</h4>
                    <div>
                      <Label htmlFor={`webhookUrl-${webhook.id}`}>Webhook URL:</Label>
                      <Input
                        id={`webhookUrl-${webhook.id}`}
                        type="url"
                        placeholder="Enter webhook URL"
                        value={webhook.url}
                        onChange={e =>
                          handleWebhookChange(webhook.id, 'url', e.target.value)
                        }
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`charging-${webhook.id}`}
                        checked={webhook.charging}
                        onCheckedChange={checked =>
                          handleWebhookChange(webhook.id, 'charging', checked!)
                        }
                      />
                      <Label htmlFor={`charging-${webhook.id}`}>Charging Status</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`orientation-${webhook.id}`}
                        checked={webhook.orientation}
                        onCheckedChange={checked =>
                          handleWebhookChange(webhook.id, 'orientation', checked!)
                        }
                      />
                      <Label htmlFor={`orientation-${webhook.id}`}>Screen Orientation</Label>
                    </div>
                  </div>
                ))}

                <Button type="submit">Save Webhook Configurations</Button>
              </form>

              <Button variant="outline" onClick={handleAddWebhook}>
                Add Webhook Trigger
              </Button>
            </CardContent>
          </Card>
        </section>
      </DialogContent>
    </Dialog>
  );
}

