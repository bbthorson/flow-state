// ── Trigger types (derived from app.flowstate.trigger.* lexicons) ──

export type TriggerType = 'NATIVE_BATTERY' | 'NETWORK' | 'GEOLOCATION' | 'DEEP_LINK' | 'MANUAL' | 'IDLE' | 'DEVICE_MOTION' | 'SCREEN_ORIENTATION' | 'TIME';

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

export interface ScheduleTriggerDetails {
  time: string; // 'HH:MM' 24-hour
  days: number[]; // 0-6 (Sun-Sat); empty = every day
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

// ── Social & Federated Automation Types (ATProto Spaces & Recipes) ──

export type FlowScope = 'local' | 'space';
export type FlowVisibility = 'public' | 'space' | 'private';

export interface FlowParameterDefinition {
  key: string;
  label: string;
  description?: string;
  type: 'string' | 'number' | 'boolean' | 'secret';
  required?: boolean;
  default?: string | number | boolean;
}

export interface FlowRecipe {
  id?: string; // or AT URI when published (at://did:plc:.../app.flowstate.flow/rkey)
  name: string;
  description?: string;
  authorDid?: string;
  tags?: string[];
  forkedFromUri?: string;
  visibility?: FlowVisibility;
  parameters?: FlowParameterDefinition[];
  trigger: {
    type: TriggerType;
    details: Record<string, any>;
  };
  actions: Array<{
    type: ActionType;
    details: Record<string, any>;
  }>;
}

// ── Flow record (derived from app.flowstate.flow lexicon, with Spaces & Social extensions) ──

export interface Flow {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  securityKey?: string;
  /** Provenance: AT URI of the recipe or flow this instance was installed/forked from */
  forkedFromUri?: string;
  /** Storage & execution scope: 'local' (device only) or 'space' (ATProto Spaces repository) */
  scope?: FlowScope;
  /** Identifier of the ATProto Space if scope === 'space' */
  spaceId?: string;
  /** Discoverable category or tag labels */
  tags?: string[];
  /** Optional parameter declarations required by this flow */
  parameters?: FlowParameterDefinition[];
  /**
   * Sensitive credentials (API tokens, webhooks, auth keys).
   * Strictly local to the device or synced to private ATProto Spaces.
   * NEVER published to public ATProto repositories or public recipes.
   */
  secrets?: Record<string, string>;
  trigger: {
    type: TriggerType;
    details: Record<string, any>;
  };
  actions: Array<{
    type: ActionType;
    details: Record<string, any>;
  }>;
}

// ── Day timeline (local, recurring daily plan) ──

export type BlockKind = 'focus' | 'care' | 'triage';

export interface TimeBlock {
  id: string;
  title: string;
  kind: BlockKind;
  start: string; // 'HH:MM' 24-hour
  end: string; // 'HH:MM' 24-hour
}

export interface LogEntry {
  id: string;
  flowId: string; // or 'SYSTEM'
  timestamp: number;
  status: 'success' | 'failure';
  message: string;
}

// ── AT Protocol publishing (derived from app.flowstate.install lexicon) ──

export interface PublishedFlowRef {
  /** AT URI of the published record */
  uri: string;
  /** Record key on the PDS */
  rkey: string;
}
  
/** Injected from package.json by Vite's `define` — see vite.config.ts. */
declare global {
  const __APP_VERSION__: string;
}
