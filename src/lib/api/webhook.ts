import { sendWebhookNotification } from '@/services/webhook';

export type WebhookConfig = { 
  id: string;
  url: string;
  charging: boolean;
  orientation: boolean;
};

export async function canSendWebhook(
  webhookConfig: WebhookConfig,
  charging: boolean | null,
  faceDown: boolean | null
): boolean {
  return (
    (webhookConfig.charging && charging === true) ||
    (webhookConfig.orientation && faceDown === true)
  );
}

export async function sendWebhook(
  webhookConfig: WebhookConfig,
  charging: boolean | null,
  faceDown: boolean | null
): Promise<boolean> {
  if (canSendWebhook(webhookConfig, charging, faceDown)) {
    try {
      await sendWebhookNotification(webhookConfig.url, {
        message: 'Device status changed',
        timestamp: new Date().toISOString(),
        trigger: { charging, orientation: faceDown },
      });
      return true;
    } catch (error) {
      console.error('Error sending webhook:', error);
      return false;
    }
  }
  return false; 
}