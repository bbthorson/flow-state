import type { Assertion, Flow, FlowAction, FlowStep, TriggerType } from '@/types';
import { templateString } from '@/services/actions';
import { UNTRUSTED_ROOTS, delayToMs } from '@/lib/steps';

/**
 * The run engine: decides whether a trigger fires a flow, then walks its steps.
 *
 * Pure apart from the callbacks in `RunHooks`, so it is tested without the store
 * or any browser API. Placeholder data a run sees:
 *
 *   trigger.*  what the trigger reported (UNTRUSTED: a deep link's query string)
 *   device.*   a snapshot of current device state
 *   time.*     hour, minute, weekday (0-6), date, iso
 *   secrets.*  this flow's device-only secret values
 *   <name>     each variableStep's rendered value, and each named action's result
 */

export type RunData = Record<string, any>;

export interface ScheduledRun {
  flowId: string;
  stepId: string;
  identifier: string;
  dueAt: number;
  expiresAt?: number;
  action: FlowAction;
  data: RunData;
  trustedRoots: string[];
}

export interface RunHooks {
  execute: (
    action: FlowAction,
    data: RunData,
    trustedRoots: ReadonlySet<string>,
  ) => Promise<{ success: boolean; message?: string }>;
  log: (status: 'success' | 'failure', message: string) => void;
  schedule: (run: ScheduledRun) => void;
  cancelScheduled: (identifier: string) => void;
  /** Human label for log messages; defaults to the action type. */
  labelFor?: (action: FlowAction) => string;
}

export interface RunOutcome {
  /** 'gated' when a condition gate ended the run before every step ran. */
  status: 'completed' | 'gated' | 'failed';
  executed: number;
  scheduled: number;
}

// ── Trigger matching ──

/**
 * Does this flow's trigger configuration accept what the device just reported?
 *
 * v1 required every configured key to equal a reported key, which silently
 * broke triggers whose config isn't an event field: a battery `level` threshold
 * or the idle `threshold` never equals anything reported, so those flows could
 * never fire. Thresholds belong in conditions now; matching is per type.
 *
 * GEOLOCATION, TIME and DEEP_LINK are matched by their dispatchers (zone
 * transitions, the clock, the link's params and secret) and arrive targeted
 * at one flow, so they are accepted here.
 */
export function matchesTrigger(type: TriggerType, config: Record<string, any>, data: RunData): boolean {
  switch (type) {
    case 'NATIVE_BATTERY': {
      // "Entered the configured state": fires when the state (charging matches
      // AND level at or below the threshold) goes from false to true.
      const inState = (s: { charging?: boolean; level?: number } | undefined) =>
        !!s &&
        (config.charging === undefined || s.charging === config.charging) &&
        (config.level === undefined || (typeof s.level === 'number' && s.level <= config.level));
      return inState(data) && !inState(data.previous);
    }
    case 'NETWORK':
      // `ssid` is not exposed to web pages, so it cannot be matched.
      return config.online === undefined || data.online === config.online;
    case 'IDLE':
      return data.userState === 'idle' || (!!config.detectScreen && data.screenState === 'locked');
    case 'DEVICE_MOTION':
      return config.gesture === undefined || data.gesture === config.gesture;
    case 'SCREEN_ORIENTATION':
      return config.orientation === undefined || data.orientation === config.orientation;
    case 'EVENT': {
      if (typeof data.expiresAt === 'string' && Date.parse(data.expiresAt) < Date.now()) return false;
      return config.event === '*' || data.event === config.event;
    }
    case 'MANUAL':
    case 'GEOLOCATION':
    case 'TIME':
    case 'DEEP_LINK':
      return true;
    default:
      return false;
  }
}

// ── Values and assertions ──

export function getPath(data: RunData, path: string): unknown {
  let current: any = data;
  for (const part of path.split('.')) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

function placeholderRoots(template: string): string[] {
  return [...template.matchAll(/\{\{(.*?)\}\}/g)].map((m) => m[1].trim().split('.')[0]);
}

export function evaluateAssertion(assertion: Assertion, data: RunData): boolean {
  const actual = getPath(data, assertion.field);
  const expected = assertion.value === undefined ? '' : templateString(assertion.value, data);
  const op = assertion.operator ?? 'eq';

  const present = actual !== undefined && actual !== null && actual !== '';
  if (op === 'exists') return present;
  if (op === 'notExists') return !present;

  if (op === 'gt' || op === 'gte' || op === 'lt' || op === 'lte') {
    const a = typeof actual === 'number' ? actual : parseFloat(String(actual));
    const b = parseFloat(expected);
    if (Number.isNaN(a) || Number.isNaN(b)) return false;
    return op === 'gt' ? a > b : op === 'gte' ? a >= b : op === 'lt' ? a < b : a <= b;
  }

  const text = actual === undefined || actual === null ? '' : String(actual);
  switch (op) {
    case 'eq':
      return text === expected;
    case 'neq':
      return text !== expected;
    case 'contains':
      return Array.isArray(actual) ? actual.map(String).includes(expected) : text.includes(expected);
    case 'notContains':
      return Array.isArray(actual) ? !actual.map(String).includes(expected) : !text.includes(expected);
    case 'startsWith':
      return text.startsWith(expected);
    case 'endsWith':
      return text.endsWith(expected);
    default:
      return false;
  }
}

export function timeData(now: Date) {
  return {
    hour: now.getHours(),
    minute: now.getMinutes(),
    weekday: now.getDay(),
    date: now.toLocaleDateString(),
    iso: now.toISOString(),
  };
}

// ── Running ──

export async function runFlow(
  flow: Flow,
  triggerData: RunData,
  context: { device: RunData; now: Date; extra?: RunData },
  hooks: RunHooks,
): Promise<RunOutcome> {
  const data: RunData = {
    ...context.extra,
    trigger: triggerData,
    device: context.device,
    time: timeData(context.now),
    secrets: { ...flow.secrets },
  };
  // Variables whose value was built from untrusted data are tainted too, so a
  // variable can't launder trigger data into a webhook URL.
  const tainted = new Set<string>(UNTRUSTED_ROOTS);
  const trustedRoots = (): Set<string> => {
    const roots = new Set<string>(['secrets', 'device', 'time', 'self']);
    for (const key of Object.keys(data)) if (!tainted.has(key)) roots.add(key);
    return roots;
  };

  const outcome: RunOutcome = { status: 'completed', executed: 0, scheduled: 0 };
  const now = context.now.getTime();

  const walk = async (steps: FlowStep[]): Promise<'continue' | 'stop'> => {
    for (const step of steps) {
      switch (step.type) {
        case 'variable': {
          if (step.kind === 'secret') {
            data[step.name] = flow.secrets?.[step.name];
          } else {
            const raw = step.value ?? '';
            data[step.name] = templateString(raw, data);
            if (placeholderRoots(raw).some((root) => tainted.has(root))) tainted.add(step.name);
          }
          break;
        }

        case 'condition': {
          const results = step.assertions.map((a) => evaluateAssertion(a, data));
          const held = (step.match ?? 'all') === 'any' ? results.some(Boolean) : results.every(Boolean);
          if (!step.then) {
            if (!held) {
              outcome.status = 'gated';
              return 'stop';
            }
            break;
          }
          const branch = held ? step.then : step.else ?? [];
          if ((await walk(branch)) === 'stop') return 'stop';
          break;
        }

        case 'cancelScheduled': {
          if (!flow.dryRun) hooks.cancelScheduled(templateString(step.identifier, data));
          else hooks.log('success', `Dry run: would cancel scheduled "${templateString(step.identifier, data)}"`);
          break;
        }

        case 'action': {
          const label = hooks.labelFor?.(step.action) ?? step.action.type;
          if (step.schedule) {
            const render = (expr: string) => templateString(expr, data);
            const delayMs = delayToMs(step.schedule.delay, render);
            if (delayMs === null) {
              hooks.log('failure', `${label} not scheduled: delay is not a number`);
              break;
            }
            const expireMs = step.schedule.expireAfter ? delayToMs(step.schedule.expireAfter, render) : null;
            const identifier = render(step.schedule.identifier);
            if (flow.dryRun) {
              hooks.log('success', `Dry run: would schedule ${label} as "${identifier}" in ${Math.round(delayMs / 1000)}s`);
              break;
            }
            hooks.schedule({
              flowId: flow.id,
              stepId: step.id,
              identifier,
              dueAt: now + delayMs,
              expiresAt: expireMs === null ? undefined : now + delayMs + expireMs,
              action: step.action,
              data: structuredClone(data),
              trustedRoots: [...trustedRoots()],
            });
            outcome.scheduled++;
            break;
          }

          if (flow.dryRun) {
            hooks.log('success', `Dry run: would run ${label}`);
            break;
          }
          const result = await hooks.execute(step.action, data, trustedRoots());
          outcome.executed++;
          if (step.name) {
            data[step.name] = result;
            tainted.add(step.name); // a response can echo request data
          }
          if (!result.success) {
            hooks.log('failure', `${label} failed: ${result.message ?? 'unknown error'}`);
          }
          break;
        }
      }
    }
    return 'continue';
  };

  try {
    await walk(flow.steps);
  } catch (err) {
    outcome.status = 'failed';
    hooks.log('failure', `Run failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  return outcome;
}
