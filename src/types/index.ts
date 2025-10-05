export type WebhookConfig = {
    id: string;
    name: string;
    url: string;
    charging: boolean;
    orientation: boolean;
    enabled: boolean;
  };
  
  export interface SettingsSectionProps {
    onWebhookSent: (success: boolean, url: string) => Promise<void>;
  }
  