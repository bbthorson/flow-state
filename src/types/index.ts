// ── Trigger types (derived from app.flowstate.trigger.* lexicons) ──

export type TriggerType = 'NATIVE_BATTERY' | 'NETWORK' | 'GEOLOCATION' | 'DEEP_LINK' | 'MANUAL' | 'IDLE' | 'DEVICE_MOTION' | 'SCREEN_ORIENTATION' | 'TIME' | 'EVENT';

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

/**
 * Fires on an app.flowstate.event. Only `source: local` (emitted by another flow
 * on this device) exists so far; spaces and the hub come later.
 */
export interface EventTriggerDetails {
  /** Event name to match, or '*' for any. */
  event: string;
  /** Keys of the event's `data` that actions may read as {{event.data.<key>}}. */
  exposeData?: string[];
}

export interface ScheduleTriggerDetails {
  time: string; // 'HH:MM' 24-hour
  days: number[]; // 0-6 (Sun-Sat); empty = every day
}

// ── Action types (derived from app.flowstate.action.* lexicons) ──

export type ActionType = 'WEBHOOK' | 'NOTIFICATION' | 'LOG' | 'VIBRATION' | 'CLIPBOARD' | 'WEB_SHARE' | 'WAKE_LOCK' | 'SPEECH' | 'EMIT_EVENT';

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

export interface EmitEventActionDetails {
  event: string;
  title?: string;
  body?: string;
  urgency?: 'low' | 'normal' | 'high';
  ttlSeconds?: number;
  /** Flat key/value payload; values may use templates. */
  data?: Record<string, string>;
}

/** An app.flowstate.event as flows receive it. */
export interface FlowEvent {
  event: string;
  title?: string;
  body?: string;
  urgency?: 'low' | 'normal' | 'high';
  data?: Record<string, string | number | boolean>;
  createdAt: string;
  expiresAt?: string;
  /** Who wrote it: 'self' for local events; a DID once events arrive from spaces. */
  author: string;
  /** How many emitEvent hops produced this event (loop guard). */
  hops: number;
}

export interface SpeechActionDetails {
  text: string;
  rate?: number; // 0.1-10
  pitch?: number; // 0-2
  volume?: number; // 0-1
}

// ── Automation model (v2, mirrors docs/design/lexicons/app.flowstate.automation.json) ──
//
// The local shape keeps `{ type, details }` for triggers and actions because the
// form, labels and permission registry are keyed by those enums; conversion to
// the lexicon's `$type` unions happens at the record boundary
// (`src/lib/automation-record.ts`).

export type AssertionOperator =
  | 'eq' | 'neq' | 'contains' | 'notContains' | 'startsWith' | 'endsWith'
  | 'gt' | 'gte' | 'lt' | 'lte' | 'exists' | 'notExists';

export interface Assertion {
  /** Dot path: trigger.*, device.*, time.*, event.*, or a variable name. */
  field: string;
  operator?: AssertionOperator;
  value?: string;
  comment?: string;
}

export interface RelativeDelay {
  unit: 'ms' | 's' | 'm' | 'h' | 'd' | 'w';
  value: { kind: 'literal'; n: number } | { kind: 'template'; expr: string } | { kind: 'sum'; expr: string; offset: number };
}

export interface ScheduleModifier {
  identifier: string;
  delay: RelativeDelay;
  expireAfter?: RelativeDelay;
}

export interface ConditionStep {
  type: 'condition';
  id: string;
  match?: 'all' | 'any';
  assertions: Assertion[];
  then?: FlowStep[];
  else?: FlowStep[];
  comment?: string;
}

export type VariableKind = 'string' | 'number' | 'boolean' | 'secret';

export interface VariableStep {
  type: 'variable';
  id: string;
  name: string;
  kind?: VariableKind;
  /** Literal or template. Never set for secrets — those resolve from `Flow.secrets[name]`. */
  value?: string;
  label?: string;
  note?: string;
  required?: boolean;
  preserveOnDuplication?: boolean;
  comment?: string;
}

export interface FlowAction {
  type: ActionType;
  details: Record<string, any>;
}

export interface ActionStep {
  type: 'action';
  id: string;
  name?: string;
  action: FlowAction;
  schedule?: ScheduleModifier;
  comment?: string;
}

export interface CancelScheduledStep {
  type: 'cancelScheduled';
  id: string;
  identifier: string;
  comment?: string;
}

export type FlowStep = ConditionStep | VariableStep | ActionStep | CancelScheduledStep;

export interface FlowTrigger {
  type: TriggerType;
  details: Record<string, any>;
}

/** Shareable content of a flow: what gets published as an automation record. */
export interface FlowRecipe {
  /** AT URI when this came from the network. */
  id?: string;
  authorDid?: string;
  name: string;
  description?: string;
  tags?: string[];
  forkedFromUri?: string;
  trigger: FlowTrigger;
  steps: FlowStep[];
}

export interface Flow {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  /** Root automation this was duplicated from (flattened lineage). */
  forkedFromUri?: string;
  active: boolean;
  /** Evaluate and log runs without executing any action. */
  dryRun: boolean;
  trigger: FlowTrigger;
  steps: FlowStep[];
  /**
   * Values for `kind: 'secret'` variables, keyed by variable name. Device-only:
   * never written to any record, public or private.
   */
  secrets?: Record<string, string>;
  createdAt: string;
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
