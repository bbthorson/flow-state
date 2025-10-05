// src/components/settings-section.tsx
'use client';

import { FormEvent, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { sendWebhookNotification } from '@/services/webhook';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAppStore } from '@/store/useAppStore';
import { WebhookConfig, SettingsSectionProps } from '@/types'; // Import SettingsSectionProps

import { Switch } from '@/components/ui/switch';

import { WebhookHelper } from './webhook-helper';

import { Permissions } from './permissions';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function SettingsSection({ onWebhookSent }: SettingsSectionProps) {
  const { toast } = useToast();
  const { webhooks, setWebhooks } = useAppStore(); // Use webhooks and setWebhooks from the store
  const [showWebhookHelper, setShowWebhookHelper] = useState(false);

  useEffect(() => {
    const hasDismissed = localStorage.getItem('hasDismissedWebhookHelper');
    if (!hasDismissed && webhooks.length === 0) {
      setShowWebhookHelper(true);
    }
  }, [webhooks]);

  const handleWebhookChange = (
    id: string,
    field: string,
    value: string | boolean
  ) => {
    setWebhooks(prevWebhooks => // Use setWebhooks from the store
      prevWebhooks.map(webhook =>
        webhook.id === id ? { ...webhook, [field]: value } : webhook
      )
    );
  };

  const handleTestWebhook = async (webhook: WebhookConfig) => {
    try {
      const success = await sendWebhookNotification(webhook.url || '', {
        message: 'Test notification from Do Not Disturb',
        timestamp: new Date().toISOString(),
        trigger: {
          charging: webhook.charging,
          orientation: webhook.orientation,
        },
      });
      if (success) {
        onWebhookSent(true, webhook.url);
      } else {
        onWebhookSent(false, webhook.url);
      }
    } catch (error) {
      toast({
        description: `Failed to send test notification for webhook ${webhook.id}.`,
      });
    }
  };

  const handleAddWebhook = () => {
    const newId = Math.random().toString(36).substring(7);
    setWebhooks([ // Use setWebhooks from the store
      ...webhooks,
      { id: newId, name: '', url: '', charging: false, orientation: false, enabled: true },
    ]);
  };

  const handleCloseWebhookHelper = () => {
    localStorage.setItem('hasDismissedWebhookHelper', 'true');
    setShowWebhookHelper(false);
  };

  return (
    <section className="w-full max-w-md flex flex-col gap-4">
      <Permissions />

      <Card>
        <CardHeader>
          <CardTitle>Webhook Configuration</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {showWebhookHelper && <WebhookHelper onClose={handleCloseWebhookHelper} />}
          <Accordion type="single" collapsible className="w-full">
            {webhooks.map(webhook => (
              <AccordionItem value={webhook.id} key={webhook.id}>
                <AccordionTrigger>{webhook.name || 'Webhook'}</AccordionTrigger>
                <AccordionContent>
                  <div className="flex flex-col gap-4 pt-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold">Enabled</h4>
                      <Switch
                        id={`enabled-${webhook.id}`}
                        checked={webhook.enabled}
                        onCheckedChange={checked =>
                          handleWebhookChange(webhook.id, 'enabled', checked!)
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor={`webhookName-${webhook.id}`}>Name:</Label>
                      <Input
                        id={`webhookName-${webhook.id}`}
                        type="text"
                        placeholder="Enter a name for your webhook"
                        value={webhook.name}
                        onChange={e =>
                          handleWebhookChange(webhook.id, 'name', e.target.value)
                        }
                      />
                    </div>
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
                    <Button type="button" variant="outline" onClick={() => handleTestWebhook(webhook)}>Test</Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <Button variant="outline" onClick={handleAddWebhook}>
            Add Webhook Trigger
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
