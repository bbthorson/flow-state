import { sendWebhookNotification } from '@/services/webhook';

export type WebhookConfig = { 
  id: string;
  url: string;
  charging: boolean;
  orientation: boolean;
};

export function canSendWebhook(
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
      await sendWebhookNotification(
        webhookConfig.url,
        charging || false,
        faceDown ? 'face down' : 'face up'
      );
      return true;
    } catch (error) {
      console.error('Error sending webhook:', error);
      return false;
    }
  }
  return false; 
}