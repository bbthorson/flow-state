import { formatScalar, type Capability, type Command } from '@flowstate/core';
import type { AdapterEmitFn, CapabilityAdapter, CommandDispatchResult } from './types';

function makeId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `ev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Foreground Schedule Adapter (`schedule.time`) ──

export function createScheduleTimeAdapter(): CapabilityAdapter {
  let timer: ReturnType<typeof setInterval> | null = null;
  let lastMinuteKey = '';

  const manifest: Capability = {
    id: 'schedule.time',
    kind: 'system',
    name: 'Clock Schedule',
    description: 'Fires at a time of day while the app is foregrounded.',
    emits: [
      {
        type: 'schedule.time.reached',
        label: 'Time of day reached',
        fields: [
          { name: 'time', label: 'Time (HH:MM)', type: 'string' },
          { name: 'weekday', label: 'Weekday (0-6)', type: 'number' },
        ],
      },
    ],
    accepts: [],
    runtimes: ['browser'],
    permissions: [],
  };

  return {
    manifest,
    start(emit: AdapterEmitFn) {
      const check = () => {
        const now = new Date();
        const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const key = `${now.toISOString().slice(0, 10)} ${hhmm}`;
        if (key === lastMinuteKey) return;
        lastMinuteKey = key;
        emit({
          id: makeId(),
          type: 'schedule.time.reached',
          source: 'device',
          author: 'schedule.time',
          trust: 'trusted',
          hops: 0,
          payload: { time: hhmm, weekday: now.getDay(), iso: now.toISOString() },
          createdAt: now.toISOString(),
        });
      };
      check();
      timer = setInterval(check, 30_000);
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}

// ── Geolocation Adapter (`device.geolocation`) ──

export function createGeolocationAdapter(): CapabilityAdapter {
  let watchId: number | null = null;
  let snapshot: Record<string, unknown> = {
    supported: typeof navigator !== 'undefined' && 'geolocation' in navigator,
    latitude: null,
    longitude: null,
    accuracy: null,
  };

  const manifest: Capability = {
    id: 'device.geolocation',
    kind: 'device',
    name: 'Geolocation',
    description: 'Publishes foreground location updates for geofence rules.',
    emits: [
      {
        type: 'device.geolocation.updated',
        label: 'Location updated',
        fields: [
          { name: 'latitude', label: 'Latitude', type: 'number' },
          { name: 'longitude', label: 'Longitude', type: 'number' },
          { name: 'accuracy', label: 'Accuracy (m)', type: 'number' },
        ],
      },
    ],
    accepts: [],
    runtimes: ['browser'],
    permissions: ['geolocation'],
  };

  return {
    manifest,
    getSnapshot: () => ({ geolocation: snapshot }),
    start(emit: AdapterEmitFn) {
      if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;
      // Only watch automatically if permission is already granted so we don't prompt on boot
      if (navigator.permissions?.query) {
        void navigator.permissions
          .query({ name: 'geolocation' as PermissionName })
          .then((status) => {
            if (status.state !== 'granted') return;
            watchId = navigator.geolocation.watchPosition(
              (pos) => {
                const { latitude, longitude, accuracy } = pos.coords;
                snapshot = { supported: true, latitude, longitude, accuracy };
                emit({
                  id: makeId(),
                  type: 'device.geolocation.updated',
                  source: 'device',
                  author: 'device.geolocation',
                  trust: 'trusted',
                  hops: 0,
                  payload: { latitude, longitude, accuracy },
                  createdAt: new Date(pos.timestamp).toISOString(),
                });
              },
              () => {
                // Ignore transient watch errors
              },
              { enableHighAccuracy: false, maximumAge: 60_000 },
            );
          })
          .catch(() => {});
      }
    },
    stop() {
      if (watchId !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
      watchId = null;
    },
  };
}

// ── Local Device Action Adapters (Vibration, Share, Wake Lock, Speech) ──

export function createVibrationAdapter(): CapabilityAdapter {
  const manifest: Capability = {
    id: 'local.vibration',
    kind: 'device',
    name: 'Vibration',
    description: 'Trigger haptic vibration feedback on supported Android devices.',
    emits: [],
    accepts: [
      {
        action: 'vibrate',
        label: 'Vibrate Device',
        inputs: [{ name: 'pattern', label: 'Duration / Pattern (ms)', type: 'string', defaultValue: '200' }],
      },
    ],
    runtimes: ['browser'],
    permissions: [],
  };

  return {
    manifest,
    async execute(command: Command): Promise<CommandDispatchResult> {
      if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
        return { ok: false, message: 'Vibration API not supported on this device' };
      }
      const raw = formatScalar(command.input.pattern || '200');
      const parts = raw
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n >= 0);
      const pattern = parts.length > 1 ? parts : (parts[0] ?? 200);
      navigator.vibrate(pattern);
      return { ok: true, message: `Vibrated (${raw}ms)` };
    },
  };
}

export function createShareAdapter(): CapabilityAdapter {
  const manifest: Capability = {
    id: 'local.share',
    kind: 'device',
    name: 'Web Share',
    description: 'Open the native OS share sheet with text or a URL.',
    emits: [],
    accepts: [
      {
        action: 'share',
        label: 'Share via OS Sheet',
        inputs: [
          { name: 'title', label: 'Title', type: 'string' },
          { name: 'text', label: 'Text', type: 'string' },
          { name: 'url', label: 'URL', type: 'url' },
        ],
      },
    ],
    runtimes: ['browser'],
    permissions: [],
  };

  return {
    manifest,
    async execute(command: Command): Promise<CommandDispatchResult> {
      if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
        return { ok: false, message: 'Web Share API not supported' };
      }
      await navigator.share({
        title: formatScalar(command.input.title) || undefined,
        text: formatScalar(command.input.text) || undefined,
        url: formatScalar(command.input.url) || undefined,
      });
      return { ok: true, message: 'Shared via OS sheet' };
    },
  };
}

export function createWakeLockAdapter(): CapabilityAdapter {
  let sentinel: { release(): Promise<void> } | null = null;

  const manifest: Capability = {
    id: 'local.wakelock',
    kind: 'device',
    name: 'Wake Lock',
    description: 'Keep the screen awake while focused on a task.',
    emits: [],
    accepts: [
      {
        action: 'acquire',
        label: 'Keep Screen Awake',
        inputs: [
          { name: 'mode', label: 'Mode', type: 'enum', options: ['acquire', 'release'], defaultValue: 'acquire' },
        ],
      },
    ],
    runtimes: ['browser'],
    permissions: [],
  };

  return {
    manifest,
    stop() {
      void sentinel?.release();
      sentinel = null;
    },
    async execute(command: Command): Promise<CommandDispatchResult> {
      const mode = formatScalar(command.input.mode || 'acquire');
      if (mode === 'release') {
        await sentinel?.release();
        sentinel = null;
        return { ok: true, message: 'Wake Lock released' };
      }
      const wl = typeof navigator !== 'undefined' ? (navigator as any).wakeLock : undefined;
      if (!wl || typeof wl.request !== 'function') {
        return { ok: false, message: 'Screen Wake Lock API not supported' };
      }
      sentinel = await wl.request('screen');
      return { ok: true, message: 'Screen Wake Lock active' };
    },
  };
}

export function createSpeechAdapter(): CapabilityAdapter {
  const manifest: Capability = {
    id: 'local.speech',
    kind: 'device',
    name: 'Speech',
    description: 'Read text aloud using the browser Speech Synthesis API.',
    emits: [],
    accepts: [
      {
        action: 'speak',
        label: 'Speak Text',
        inputs: [{ name: 'text', label: 'Text to Speak', type: 'string', required: true }],
      },
    ],
    runtimes: ['browser'],
    permissions: [],
  };

  return {
    manifest,
    async execute(command: Command): Promise<CommandDispatchResult> {
      const text = formatScalar(command.input.text);
      if (!text) return { ok: false, message: 'Nothing to speak' };
      if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') {
        return { ok: false, message: 'Speech Synthesis API not supported' };
      }
      speechSynthesis.speak(new SpeechSynthesisUtterance(text));
      return { ok: true, message: `Spoke "${text.slice(0, 40)}"` };
    },
  };
}
