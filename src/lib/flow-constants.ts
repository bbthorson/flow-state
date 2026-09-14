import {
  Battery,
  Wifi,
  MapPin,
  Link as LinkIcon,
  Hand,
  Clock,
  Smartphone,
  RotateCw,
  CalendarClock,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { TriggerType, ActionType } from '@/types';
import { formatSchedule } from '@/lib/schedule';

/**
 * Single source of truth for trigger/action display metadata. Previously these
 * label maps were copied (and had drifted) across FlowDetailPage, flow-form,
 * and the discover cards.
 */

export const TRIGGER_TYPES: TriggerType[] = [
  'NATIVE_BATTERY',
  'NETWORK',
  'GEOLOCATION',
  'DEEP_LINK',
  'MANUAL',
  'IDLE',
  'DEVICE_MOTION',
  'SCREEN_ORIENTATION',
  'TIME',
];

export const ACTION_TYPES: ActionType[] = [
  'WEBHOOK',
  'NOTIFICATION',
  'LOG',
  'VIBRATION',
  'CLIPBOARD',
  'WEB_SHARE',
  'WAKE_LOCK',
  'SPEECH',
];

export const TRIGGER_LABELS: Record<TriggerType, string> = {
  NATIVE_BATTERY: 'Battery',
  NETWORK: 'Network',
  GEOLOCATION: 'Geolocation',
  DEEP_LINK: 'Deep Link',
  MANUAL: 'Manual',
  IDLE: 'Idle Detection',
  DEVICE_MOTION: 'Device Motion',
  SCREEN_ORIENTATION: 'Screen Orientation',
  TIME: 'Schedule',
};

export const ACTION_LABELS: Record<ActionType, string> = {
  WEBHOOK: 'Webhook',
  NOTIFICATION: 'Notification',
  LOG: 'Log',
  VIBRATION: 'Vibration',
  CLIPBOARD: 'Clipboard',
  WEB_SHARE: 'Share',
  WAKE_LOCK: 'Wake Lock',
  SPEECH: 'Speech',
};

export const TRIGGER_ICONS: Record<TriggerType, LucideIcon> = {
  NATIVE_BATTERY: Battery,
  NETWORK: Wifi,
  GEOLOCATION: MapPin,
  DEEP_LINK: LinkIcon,
  MANUAL: Hand,
  IDLE: Clock,
  DEVICE_MOTION: Smartphone,
  SCREEN_ORIENTATION: RotateCw,
  TIME: CalendarClock,
};

/** Icon for a trigger type, falling back to a generic bolt for unknown values. */
export function triggerIcon(type: string): LucideIcon {
  return TRIGGER_ICONS[type as TriggerType] ?? Zap;
}

/**
 * One-line description of what fires a flow.
 *
 * Every branch reports only what the details actually say. The earlier version
 * collapsed unknown values into a definite claim — a geolocation trigger with
 * no `event` read as "Exit zone", the *opposite* of the other valid value, and
 * a battery trigger with no level read as "0%". Network-discovered flows are
 * validated now (see `@/lib/flow-schema`), but vault imports and flows stored
 * before that check still reach this function.
 */
export function triggerSummary(trigger: { type: string; details: Record<string, any> }): string {
  const d = trigger.details ?? {};

  switch (trigger.type) {
    case 'NATIVE_BATTERY': {
      const level = typeof d.level === 'number' ? `${Math.round(d.level * 100)}%` : null;
      const state = typeof d.charging === 'boolean' ? (d.charging ? 'charging' : 'discharging') : null;
      if (level && state) return `Battery ${state} at ${level}`;
      if (level) return `Battery at ${level}`;
      if (state) return `Battery ${state}`;
      return 'Battery change (no threshold set)';
    }
    case 'NETWORK':
      if (d.ssid) return `Connected to ${d.ssid}`;
      if (typeof d.online === 'boolean') return d.online ? 'Network online' : 'Network offline';
      return 'Network change';
    case 'GEOLOCATION': {
      const radius = typeof d.radius === 'number' ? `${d.radius}m radius` : 'radius not set';
      if (d.event === 'ENTER') return `Enter zone (${radius})`;
      if (d.event === 'EXIT') return `Exit zone (${radius})`;
      return `Zone, direction not set (${radius})`;
    }
    case 'DEEP_LINK':
      return `Deep link: ${d.event ?? 'any'}`;
    case 'IDLE':
      return typeof d.threshold === 'number'
        ? `Idle after ${Math.round(d.threshold / 1000)}s`
        : 'Idle (no threshold set)';
    case 'DEVICE_MOTION':
      return `Gesture: ${d.gesture ?? 'any'}`;
    case 'SCREEN_ORIENTATION':
      return `Orientation: ${d.orientation ?? 'any'}`;
    case 'MANUAL':
      return 'Triggered manually';
    case 'TIME':
      return formatSchedule(d);
    default:
      return '';
  }
}
