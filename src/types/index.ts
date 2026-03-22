// ── Trigger types (derived from app.flowstate.trigger.* lexicons) ──

export type TriggerType = 'NATIVE_BATTERY' | 'NETWORK' | 'GEOLOCATION' | 'DEEP_LINK' | 'MANUAL';

export interface BatteryTriggerDetails {
  level: number;
  charging: boolean;
}

export interface NetworkTriggerDetails {
  online: boolean;
  ssid?: string;
}

export interface GeolocationTriggerDetails {
  latitude: number;
  longitude: number;
  radius: number;
  event: 'ENTER' | 'EXIT';
}

export interface DeepLinkTriggerDetails {
  event: string;
}

export type ManualTriggerDetails = Record<string, never>;

// ── Action types (derived from app.flowstate.action.* lexicons) ──

export type ActionType = 'WEBHOOK' | 'NOTIFICATION' | 'LOG';

export interface WebhookActionDetails {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface NotificationActionDetails {
  title: string;
  body?: string;
  icon?: string;
}

export interface LogActionDetails {
  message?: string;
}

// ── Flow record (derived from app.flowstate.flow lexicon) ──

export interface Flow {
  id: string;
  name: string;
  enabled: boolean;
  securityKey?: string;
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
  