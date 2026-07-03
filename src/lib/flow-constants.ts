import {
  Battery,
  Wifi,
  MapPin,
  Link as LinkIcon,
  Hand,
  Clock,
  Smartphone,
  RotateCw,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { TriggerType, ActionType } from '@/types';

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
};

/** Icon for a trigger type, falling back to a generic bolt for unknown values. */
export function triggerIcon(type: string): LucideIcon {
  return TRIGGER_ICONS[type as TriggerType] ?? Zap;
}
