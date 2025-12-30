export type WebhookConfig = {
    id: string;
    name: string;
    url: string;
    charging: boolean;
    orientation: boolean;
    enabled: boolean;
  };
  

export type TriggerType = 'NATIVE_BATTERY' | 'NETWORK' | 'GEOLOCATION' | 'DEEP_LINK' | 'MANUAL';
export type ActionType = 'WEBHOOK' | 'NOTIFICATION' | 'LOG';

export interface Flow {
  id: string;
  name: string;
  enabled: boolean;
  securityKey?: string; // For Deep Links verification
  trigger: {
    type: TriggerType;
    details: Record<string, any>;
  };
  actions: Array<{
    type: ActionType;
    details: Record<string, any>;
  }>;
}

export interface LogEntry {
  id: string;
  flowId: string; // or 'SYSTEM'
  timestamp: number;
  status: 'success' | 'failure';
  message: string;
}
  