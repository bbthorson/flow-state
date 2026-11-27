import type { Assertion, Block, Context, EventMatcher, Flow, FlowStep } from './primitives';
import { formatScalar } from './taint';

/**
 * Lossless migration helpers from legacy Flow State v2 (`src/types/index.ts`)
 * into Flow State vNext primitives (`Flow`, `Context`, `Block`).
 */

const LEGACY_TRIGGER_EVENT_MAP: Record<string, string> = {
  NATIVE_BATTERY: 'device.battery.changed',
  NETWORK: 'device.network.changed',
  GEOLOCATION: 'device.geolocation.transition',
  IDLE: 'device.idle.changed',
  DEVICE_MOTION: 'device.motion.gesture',
  SCREEN_ORIENTATION: 'device.orientation.changed',
  TIME: 'schedule.time.reached',
  DEEP_LINK: 'system.deeplink.received',
  MANUAL: 'user.manual.invoked',
  EVENT: 'event.received',
};

const LEGACY_ACTION_CAPABILITY_MAP: Record<string, { capability: string; action: string; sensitive?: string[] }> = {
  WEBHOOK: { capability: 'local.webhook', action: 'request', sensitive: ['url', 'headers'] },
  NOTIFICATION: { capability: 'local.notification', action: 'show' },
  LOG: { capability: 'local.log', action: 'write' },
  VIBRATION: { capability: 'local.vibration', action: 'vibrate' },
  CLIPBOARD: { capability: 'local.clipboard', action: 'write' },
  WEB_SHARE: { capability: 'local.share', action: 'share' },
  WAKE_LOCK: { capability: 'local.wakelock', action: 'acquire' },
  SPEECH: { capability: 'local.speech', action: 'speak' },
  EMIT_EVENT: { capability: 'local.event', action: 'emit' },
};

export interface LegacyFlowLike {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  active?: boolean;
  enabled?: boolean;
  dryRun?: boolean;
  forkedFrom?: string;
  createdAt?: string;
  trigger?: { type?: string; details?: Record<string, unknown> };
  steps?: unknown[];
  actions?: Array<{ type: string; details?: Record<string, unknown> }>;
}

function migrateLegacyTrigger(trigger?: { type?: string; details?: Record<string, unknown> }): EventMatcher {
  const type = trigger?.type ?? 'MANUAL';
  const details = trigger?.details ?? {};

  if (type === 'EVENT') {
    const eventName = typeof details.event === 'string' ? details.event : '*';
    const exposePayloadKeys = Array.isArray(details.exposeData) ? details.exposeData.map(String) : undefined;
    const authors = Array.isArray(details.from) ? details.from.map(String) : undefined;
    return {
      eventType: eventName,
      ...(authors ? { authors } : {}),
      ...(exposePayloadKeys ? { exposePayloadKeys } : {}),
      config: details,
    };
  }

  const eventType = LEGACY_TRIGGER_EVENT_MAP[type] ?? `legacy.${type.toLowerCase()}`;
  const matcher: EventMatcher = {
    eventType,
    config: details,
  };

  if (type === 'NATIVE_BATTERY') {
    matcher.edgeTriggered = true;
    const where: EventMatcher['where'] = [];
    if (details.charging !== undefined) {
      where.push({ field: 'event.payload.charging', operator: 'eq', value: formatScalar(details.charging) });
    }
    if (details.level !== undefined) {
      where.push({ field: 'event.payload.level', operator: 'lte', value: formatScalar(details.level) });
    }
    if (where.length > 0) matcher.where = where;
  } else if (type === 'NETWORK' && details.online !== undefined) {
    matcher.where = [{ field: 'event.payload.online', operator: 'eq', value: formatScalar(details.online) }];
  } else if (type === 'DEVICE_MOTION' && details.gesture !== undefined) {
    matcher.where = [{ field: 'event.payload.gesture', operator: 'eq', value: formatScalar(details.gesture) }];
  } else if (type === 'SCREEN_ORIENTATION' && details.orientation !== undefined) {
    matcher.where = [{ field: 'event.payload.orientation', operator: 'eq', value: formatScalar(details.orientation) }];
  }

  return matcher;
}

function migrateLegacyStep(raw: Record<string, unknown>, idx: number): FlowStep | null {
  const id = typeof raw.id === 'string' ? raw.id : `step-${idx}`;
  const kind = raw.kind;

  if (kind === 'variable') {
    return {
      kind: 'variable',
      id,
      name: formatScalar(raw.name ?? `var_${idx}`),
      value: raw.value !== undefined ? formatScalar(raw.value) : undefined,
      secret: raw.varKind === 'secret' || raw.secret === true,
      note: typeof raw.note === 'string' ? raw.note : undefined,
      preserveOnFork: typeof raw.preserveOnDuplication === 'boolean' ? raw.preserveOnDuplication : undefined,
    };
  }

  if (kind === 'condition') {
    const assertions = Array.isArray(raw.assertions) ? (raw.assertions as Assertion[]) : [];
    return {
      kind: 'condition',
      id,
      mode: raw.mode === 'any' ? 'any' : 'all',
      assertions,
      ...(Array.isArray(raw.then)
        ? { then: raw.then.map((s, i) => migrateLegacyStep(s as Record<string, unknown>, i)).filter((s): s is FlowStep => s !== null) }
        : {}),
      ...(Array.isArray(raw.else)
        ? { else: raw.else.map((s, i) => migrateLegacyStep(s as Record<string, unknown>, i)).filter((s): s is FlowStep => s !== null) }
        : {}),
    };
  }

  if (kind === 'cancelScheduled' || kind === 'cancel') {
    return {
      kind: 'cancel',
      id,
      identifier: formatScalar(raw.identifier ?? ''),
    };
  }

  if (kind === 'action' && raw.action && typeof raw.action === 'object') {
    const act = raw.action as { type?: string; details?: Record<string, unknown> };
    const mapped = LEGACY_ACTION_CAPABILITY_MAP[act.type ?? 'LOG'] ?? {
      capability: `legacy.${String(act.type ?? 'unknown').toLowerCase()}`,
      action: 'run',
    };
    const schedule = raw.schedule as
      | { delay?: { amount: number; unit: 'seconds' | 'minutes' | 'hours' }; expireAfterSeconds?: number; identifier?: string }
      | undefined;

    return {
      kind: 'command',
      id,
      ...(typeof raw.name === 'string' ? { bindAs: raw.name } : {}),
      targetCapability: mapped.capability,
      action: mapped.action,
      input: act.details ?? {},
      ...(mapped.sensitive ? { sensitiveFields: mapped.sensitive } : {}),
      ...(schedule?.delay
        ? {
            delay: {
              amount: schedule.delay.amount,
              unit: schedule.delay.unit,
              ...(schedule.expireAfterSeconds ? { expireAfterMs: schedule.expireAfterSeconds * 1000 } : {}),
              ...(schedule.identifier ? { identifier: schedule.identifier } : {}),
            },
          }
        : {}),
    };
  }

  return null;
}

/** Migrate a legacy Flow State v1/v2 flow into a vNext Flow primitive. */
export function migrateLegacyFlow(legacy: LegacyFlowLike, contextId = 'personal'): Flow {
  let steps: FlowStep[] = [];
  if (Array.isArray(legacy.steps)) {
    steps = legacy.steps
      .map((s, i) => migrateLegacyStep(s as Record<string, unknown>, i))
      .filter((s): s is FlowStep => s !== null);
  } else if (Array.isArray(legacy.actions)) {
    steps = legacy.actions.map((a, i) => {
      const mapped = LEGACY_ACTION_CAPABILITY_MAP[a.type] ?? {
        capability: `legacy.${a.type.toLowerCase()}`,
        action: 'run',
      };
      return {
        kind: 'command' as const,
        id: `step-${i}`,
        targetCapability: mapped.capability,
        action: mapped.action,
        input: a.details ?? {},
        ...(mapped.sensitive ? { sensitiveFields: mapped.sensitive } : {}),
      };
    });
  }

  return {
    id: legacy.id,
    contextId,
    name: legacy.name || 'Untitled Flow',
    ...(legacy.description ? { description: legacy.description } : {}),
    ...(legacy.tags ? { tags: legacy.tags } : {}),
    trigger: migrateLegacyTrigger(legacy.trigger),
    inputs: [],
    steps,
    active: legacy.active ?? legacy.enabled ?? false,
    dryRun: legacy.dryRun ?? false,
    executionTarget: 'device',
    ...(legacy.forkedFrom ? { forkedFrom: legacy.forkedFrom } : {}),
    createdAt: legacy.createdAt ?? new Date().toISOString(),
  };
}

/** Create the default Personal Context (guaranteed to exist for every user). */
export function createPersonalContext(nowIso = new Date().toISOString()): Context {
  return {
    id: 'personal',
    name: 'Personal',
    kind: 'personal',
    description: 'Your private space for day-plan blocks, device flows, and personal automations.',
    participants: [],
    pinnedFlowIds: [],
    createdAt: nowIso,
  };
}

/** Migrate a legacy TimeBlock into a vNext Block primitive. */
export function migrateLegacyBlock(raw: {
  id: string;
  title: string;
  kind: 'focus' | 'care' | 'triage';
  startMin: number;
  endMin: number;
  days?: number[];
}): Block {
  return {
    id: raw.id,
    title: raw.title,
    kind: raw.kind,
    startMin: raw.startMin,
    endMin: raw.endMin,
    ...(raw.days ? { days: raw.days } : {}),
    contextId: 'personal',
  };
}

/**
 * Prepare a Flow for public recipe export or Space sharing:
 * strips runtime activation flags and non-preserved variable values.
 * Secrets are never stored on Flow (Tier-0 only), so secret steps keep only their name/note.
 */
export function sanitizeFlowForExport(flow: Flow): Omit<Flow, 'id' | 'contextId' | 'active' | 'dryRun'> {
  const cleanSteps = (steps: FlowStep[]): FlowStep[] =>
    steps.map((step) => {
      if (step.kind === 'variable') {
        if (step.secret || !step.preserveOnFork) {
          return { ...step, value: undefined };
        }
        return step;
      }
      if (step.kind === 'condition') {
        return {
          ...step,
          ...(step.then ? { then: cleanSteps(step.then) } : {}),
          ...(step.else ? { else: cleanSteps(step.else) } : {}),
        };
      }
      return step;
    });

  return {
    name: flow.name,
    ...(flow.description ? { description: flow.description } : {}),
    ...(flow.tags ? { tags: flow.tags } : {}),
    trigger: flow.trigger,
    inputs: flow.inputs,
    ...(flow.secretRefs ? { secretRefs: flow.secretRefs } : {}),
    steps: cleanSteps(flow.steps),
    executionTarget: flow.executionTarget,
    ...(flow.forkedFrom ? { forkedFrom: flow.forkedFrom } : {}),
    createdAt: flow.createdAt,
  };
}
