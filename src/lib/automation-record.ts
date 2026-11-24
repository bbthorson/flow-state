import type { ActionType, Flow, FlowAction, FlowRecipe, FlowStep, FlowTrigger, TriggerType } from '@/types';
import { parseRecipe, type ParsedRecipe } from '@/lib/flow-schema';

/**
 * Conversion between the local automation shape and `app.flowstate.automation`
 * records (draft lexicon: docs/design/lexicons/app.flowstate.automation.json).
 *
 * Locally, triggers and actions are `{ type: 'NATIVE_BATTERY', details }` because
 * the UI and permission registry are keyed by those enums. On the wire they are
 * proper `$type` union members, which v1 records never were.
 */

export const AUTOMATION_COLLECTION = 'app.flowstate.automation';

const TRIGGER_NSID: Record<TriggerType, string> = {
  NATIVE_BATTERY: 'app.flowstate.trigger.battery',
  NETWORK: 'app.flowstate.trigger.network',
  GEOLOCATION: 'app.flowstate.trigger.geolocation',
  DEEP_LINK: 'app.flowstate.trigger.deepLink',
  MANUAL: 'app.flowstate.trigger.manual',
  IDLE: 'app.flowstate.trigger.idle',
  DEVICE_MOTION: 'app.flowstate.trigger.motion',
  SCREEN_ORIENTATION: 'app.flowstate.trigger.orientation',
  TIME: 'app.flowstate.trigger.time',
  EVENT: 'app.flowstate.trigger.event',
};

const ACTION_NSID: Record<ActionType, string> = {
  WEBHOOK: 'app.flowstate.action.webhook',
  NOTIFICATION: 'app.flowstate.action.notification',
  LOG: 'app.flowstate.action.log',
  VIBRATION: 'app.flowstate.action.vibration',
  CLIPBOARD: 'app.flowstate.action.clipboard',
  WEB_SHARE: 'app.flowstate.action.share',
  WAKE_LOCK: 'app.flowstate.action.wakeLock',
  SPEECH: 'app.flowstate.action.speech',
  EMIT_EVENT: 'app.flowstate.action.emitEvent',
};

const STEP_NSID = {
  condition: `${AUTOMATION_COLLECTION}#conditionStep`,
  variable: `${AUTOMATION_COLLECTION}#variableStep`,
  action: `${AUTOMATION_COLLECTION}#actionStep`,
  cancelScheduled: `${AUTOMATION_COLLECTION}#cancelScheduledStep`,
} as const;

const invert = <K extends string>(m: Record<K, string>) =>
  Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k])) as Record<string, K>;
const TRIGGER_BY_NSID = invert(TRIGGER_NSID);
const ACTION_BY_NSID = invert(ACTION_NSID);
const STEP_BY_NSID = invert(STEP_NSID);

class UnknownTypeError extends Error {}

// ── Local → record ──

const toUnionMember = (nsid: string, details: Record<string, any>) => ({ $type: nsid, ...details });

function stepToRecord(step: FlowStep): Record<string, unknown> {
  const { type, ...rest } = step;
  switch (step.type) {
    case 'condition':
      return {
        ...rest,
        $type: STEP_NSID.condition,
        ...(step.then ? { then: step.then.map(stepToRecord) } : {}),
        ...(step.else ? { else: step.else.map(stepToRecord) } : {}),
      };
    case 'variable': {
      // Secret values never leave the device, whatever the destination.
      const { value, ...variable } = rest as Omit<typeof step, 'type'>;
      return {
        ...variable,
        $type: STEP_NSID.variable,
        ...(step.kind !== 'secret' && value !== undefined ? { value } : {}),
      };
    }
    case 'action':
      return {
        ...rest,
        $type: STEP_NSID.action,
        action: toUnionMember(ACTION_NSID[step.action.type], step.action.details),
      };
    case 'cancelScheduled':
      return { ...rest, $type: STEP_NSID.cancelScheduled };
    default:
      throw new UnknownTypeError(`unknown step type ${String(type)}`);
  }
}

/** The record for a flow (or recipe). Secrets and local-only fields are dropped. */
export function toAutomationRecord(flow: FlowRecipe & Partial<Pick<Flow, 'active' | 'dryRun' | 'createdAt'>>) {
  return {
    $type: AUTOMATION_COLLECTION,
    name: flow.name,
    ...(flow.description ? { description: flow.description } : {}),
    ...(flow.tags?.length ? { tags: flow.tags } : {}),
    ...(flow.forkedFromUri ? { forkedFrom: flow.forkedFromUri } : {}),
    trigger: toUnionMember(TRIGGER_NSID[flow.trigger.type], flow.trigger.details),
    steps: flow.steps.map(stepToRecord),
    active: flow.active ?? true,
    dryRun: flow.dryRun ?? false,
    createdAt: flow.createdAt ?? new Date().toISOString(),
  };
}

// ── Record → local ──

function splitMember<T extends string>(
  value: unknown,
  byNsid: Record<string, T>,
  what: string,
): { type: T; details: Record<string, any> } {
  if (!value || typeof value !== 'object') throw new UnknownTypeError(`${what} is not an object`);
  const { $type, ...details } = value as Record<string, any>;
  const type = byNsid[$type];
  if (!type) throw new UnknownTypeError(`unknown ${what} type ${String($type)}`);
  return { type, details };
}

function stepFromRecord(value: unknown): FlowStep {
  if (!value || typeof value !== 'object') throw new UnknownTypeError('step is not an object');
  const { $type, ...rest } = value as Record<string, any>;
  const type = STEP_BY_NSID[$type];
  if (!type) throw new UnknownTypeError(`unknown step type ${String($type)}`);
  switch (type) {
    case 'condition':
      return {
        ...rest,
        type,
        ...(Array.isArray(rest.then) ? { then: rest.then.map(stepFromRecord) } : {}),
        ...(Array.isArray(rest.else) ? { else: rest.else.map(stepFromRecord) } : {}),
      } as FlowStep;
    case 'action':
      return { ...rest, type, action: splitMember(rest.action, ACTION_BY_NSID, 'action') as FlowAction } as FlowStep;
    default:
      return { ...rest, type } as FlowStep;
  }
}

/**
 * Parse a record read off a PDS. Anything this build can't represent (unknown
 * trigger, action or step types, even though the lexicon unions are open) is
 * rejected, as is anything that fails validation.
 */
export function parseAutomationRecord(
  value: unknown,
): { ok: true; recipe: ParsedRecipe } | { ok: false; reason: string } {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, reason: '(root): not an object' };
    const v = value as Record<string, any>;
    const local = {
      name: v.name,
      description: v.description,
      tags: v.tags,
      forkedFromUri: v.forkedFrom,
      trigger: splitMember(v.trigger, TRIGGER_BY_NSID, 'trigger') as FlowTrigger,
      steps: Array.isArray(v.steps) ? v.steps.map(stepFromRecord) : v.steps,
    };
    if (!Array.isArray(local.steps) || local.steps.length === 0) return { ok: false, reason: 'steps: needs at least one step' };
    return parseRecipe(local);
  } catch (err) {
    if (err instanceof UnknownTypeError) return { ok: false, reason: err.message };
    throw err;
  }
}
