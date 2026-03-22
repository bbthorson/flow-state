// ── Trigger types (derived from app.flowstate.trigger.* lexicons) ──

export type TriggerType = 'NATIVE_BATTERY' | 'NETWORK' | 'GEOLOCATION' | 'DEEP_LINK' | 'MANUAL' | 'IDLE' | 'DEVICE_MOTION' | 'SCREEN_ORIENTATION';

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

export interface IdleTriggerDetails {
  threshold: number; // ms, minimum 60000
  detectScreen: boolean;
}

export interface DeviceMotionTriggerDetails {
  gesture: 'SHAKE' | 'FACE_DOWN' | 'FACE_UP';
}

export interface ScreenOrientationTriggerDetails {
  orientation: 'portrait' | 'landscape';
}

// ── Action types (derived from app.flowstate.action.* lexicons) ──

export type ActionType = 'WEBHOOK' | 'NOTIFICATION' | 'LOG' | 'VIBRATION' | 'CLIPBOARD' | 'WEB_SHARE' | 'WAKE_LOCK' | 'SPEECH';

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

export interface VibrationActionDetails {
  duration?: number; // ms
  pattern?: number[]; // alternating vibrate/pause durations
}

export interface ClipboardActionDetails {
  text: string;
}

export interface WebShareActionDetails {
  title?: string;
  text?: string;
  url?: string;
}

export interface WakeLockActionDetails {
  duration?: number; // ms, optional auto-release
}

export interface SpeechActionDetails {
  text: string;
  rate?: number; // 0.1-10
  pitch?: number; // 0-2
  volume?: number; // 0-1
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
  