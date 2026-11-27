import type {
  Assertion,
  Checkpoint,
  Command,
  Event,
  EventMatcher,
  Flow,
  FlowStep,
  RelativeDelay,
  RunData,
  RunStatus,
  RunTrace,
  StepTrace,
} from './primitives';
import { formatScalar, getPath, isTemplateTrusted, renderTemplate } from './taint';

/** Event chains (`emitEvent` -> event trigger -> `emitEvent`) stop after this many hops. */
export const MAX_EVENT_HOPS = 5;

export interface EngineEnv {
  /** Current epoch milliseconds (defaults to `Date.now()`). */
  now?: number;
  /** Snapshot of current device state exposed as `device.*` (trusted). */
  device?: Record<string, unknown>;
  /** User-supplied primitive form inputs exposed as `inputs.*` (trusted). */
  inputs?: Record<string, unknown>;
  /** Deterministic ID generator for commands, checkpoints, and runs. */
  createId?: () => string;
}

export interface ExecutionResult {
  status: RunStatus;
  commands: Command[];
  checkpoints: Checkpoint[];
  cancelIdentifiers: string[];
  trace: RunTrace;
}

let fallbackCounter = 0;
function defaultCreateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  fallbackCounter += 1;
  return `id-${Date.now()}-${fallbackCounter}`;
}

export function delayToMs(delay: RelativeDelay): number {
  const mult = delay.unit === 'hours' ? 3_600_000 : delay.unit === 'minutes' ? 60_000 : 1_000;
  return Math.max(0, delay.amount * mult);
}

/** Build `time.*` snapshot from a timestamp. */
export function buildTimeSnapshot(nowMs: number): Record<string, unknown> {
  const d = new Date(nowMs);
  return {
    hour: d.getHours(),
    minute: d.getMinutes(),
    weekday: d.getDay(),
    date: d.toISOString().slice(0, 10),
    iso: d.toISOString(),
    timestamp: nowMs,
  };
}

// ── Assertions & Event Matching ──

export function evaluateAssertion(assertion: Assertion, data: RunData): boolean {
  const actual = getPath(data, assertion.field);
  const op = assertion.operator ?? 'eq';
  const present = actual !== undefined && actual !== null && actual !== '';

  if (op === 'exists') return present;
  if (op === 'notExists') return !present;

  const expected =
    assertion.value === undefined
      ? ''
      : renderTemplate(assertion.value, data, new Set(Object.keys(data))).ok
        ? (renderTemplate(assertion.value, data, new Set(Object.keys(data))) as { ok: true; value: string }).value
        : assertion.value;

  const actualStr = formatScalar(actual);

  switch (op) {
    case 'eq':
      return actualStr === expected;
    case 'neq':
      return actualStr !== expected;
    case 'gt':
      return Number(actual) > Number(expected);
    case 'gte':
      return Number(actual) >= Number(expected);
    case 'lt':
      return Number(actual) < Number(expected);
    case 'lte':
      return Number(actual) <= Number(expected);
    case 'contains':
      return actualStr.includes(expected);
    case 'notContains':
      return !actualStr.includes(expected);
    case 'startsWith':
      return actualStr.startsWith(expected);
    case 'endsWith':
      return actualStr.endsWith(expected);
    case 'matches': {
      try {
        return new RegExp(expected).test(actualStr);
      } catch {
        return false;
      }
    }
    case 'in': {
      const list = assertion.values ?? expected.split(',').map((s) => s.trim());
      return list.includes(actualStr);
    }
    default:
      return false;
  }
}

/**
 * Filter an Event's payload to the keys declared in `exposePayloadKeys` (if specified).
 */
export function projectEventPayload(event: Event, exposePayloadKeys?: string[]): Record<string, unknown> {
  if (!exposePayloadKeys || exposePayloadKeys.length === 0) {
    return { ...event.payload };
  }
  const allowed = new Set(exposePayloadKeys);
  return Object.fromEntries(Object.entries(event.payload).filter(([k]) => allowed.has(k)));
}

/**
 * Determine whether an Event matches a Flow's EventMatcher.
 *
 * When `matcher.edgeTriggered` is true and `prevEvent` is supplied, the matcher
 * returns true only when `where` transitions from false -> true (e.g. battery
 * crossing below 20% while unplugged).
 */
export function matchesEvent(
  matcher: EventMatcher,
  event: Event,
  options?: { now?: number; prevEvent?: Event; device?: Record<string, unknown> },
): boolean {
  const now = options?.now ?? Date.now();

  if (event.expiresAt && Date.parse(event.expiresAt) < now) {
    return false;
  }

  if (matcher.eventType !== '*' && matcher.eventType !== event.type) {
    return false;
  }

  if (matcher.source && matcher.source !== event.source) {
    return false;
  }

  if (matcher.authors && matcher.authors.length > 0 && !matcher.authors.includes(event.author)) {
    return false;
  }

  if (matcher.where && matcher.where.length > 0) {
    const evalFor = (ev: Event) => {
      const data: RunData = {
        event: { ...ev, payload: projectEventPayload(ev, matcher.exposePayloadKeys) },
        trigger: projectEventPayload(ev, matcher.exposePayloadKeys),
        device: options?.device ?? {},
        time: buildTimeSnapshot(now),
      };
      return matcher.where!.every((a) => evaluateAssertion(a, data));
    };

    const currentMatches = evalFor(event);
    if (!currentMatches) return false;

    if (matcher.edgeTriggered && options?.prevEvent) {
      const prevMatches = evalFor(options.prevEvent);
      if (prevMatches) return false;
    }
  }

  return true;
}

// ── Step Execution ──

interface WalkContext {
  flow: Flow;
  runId: string;
  now: number;
  createId: () => string;
  data: RunData;
  trustedRoots: Set<string>;
  commands: Command[];
  checkpoints: Checkpoint[];
  cancelIdentifiers: string[];
  steps: StepTrace[];
}

function renderInputValue(
  value: unknown,
  data: RunData,
  trustedRoots: ReadonlySet<string>,
  requireTrusted: boolean,
): { ok: true; value: unknown; secretKeys: string[] } | { ok: false; reason: string } {
  if (typeof value === 'string') {
    const res = renderTemplate(value, data, trustedRoots, { requireTrusted });
    if (!res.ok) return { ok: false, reason: res.reason };
    return { ok: true, value: res.value, secretKeys: res.secretKeys };
  }
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    const secretKeys: string[] = [];
    for (const item of value) {
      const res = renderInputValue(item, data, trustedRoots, requireTrusted);
      if (!res.ok) return res;
      out.push(res.value);
      secretKeys.push(...res.secretKeys);
    }
    return { ok: true, value: out, secretKeys };
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    const secretKeys: string[] = [];
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const res = renderInputValue(v, data, trustedRoots, requireTrusted);
      if (!res.ok) return res;
      out[k] = res.value;
      secretKeys.push(...res.secretKeys);
    }
    return { ok: true, value: out, secretKeys };
  }
  return { ok: true, value, secretKeys: [] };
}

type WalkOutcome = 'completed' | 'gated' | 'paused' | 'failed';

function walkSteps(steps: FlowStep[], ctx: WalkContext): WalkOutcome {
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const remaining = steps.slice(i + 1);
    const stepStart = ctx.now;

    if (step.kind === 'variable') {
      if (step.secret) {
        // Secrets are never materialized in run data; bind placeholder reference
        ctx.data[step.name] = `{{secrets.${step.name}}}`;
        ctx.trustedRoots.add(step.name);
        ctx.steps.push({
          stepId: step.id,
          kind: 'variable',
          status: ctx.flow.dryRun ? 'dry-run' : 'ok',
          summary: `Bound secret ref "${step.name}"`,
          durationMs: 0,
        });
        continue;
      }

      const raw = step.value ?? '';
      const trusted = isTemplateTrusted(raw, ctx.trustedRoots);
      const rendered = renderTemplate(raw, ctx.data, ctx.trustedRoots);
      if (rendered.ok) {
        ctx.data[step.name] = rendered.value;
        if (trusted) {
          ctx.trustedRoots.add(step.name);
        } else {
          ctx.trustedRoots.delete(step.name);
        }
        ctx.steps.push({
          stepId: step.id,
          kind: 'variable',
          status: ctx.flow.dryRun ? 'dry-run' : 'ok',
          summary: `Set ${step.name} = "${rendered.value}"`,
          durationMs: 0,
        });
      }
      continue;
    }

    if (step.kind === 'condition') {
      const mode = step.mode ?? 'all';
      const passed =
        mode === 'any'
          ? step.assertions.some((a) => evaluateAssertion(a, ctx.data))
          : step.assertions.every((a) => evaluateAssertion(a, ctx.data));

      if (!step.then && !step.else) {
        if (!passed) {
          ctx.steps.push({
            stepId: step.id,
            kind: 'condition',
            status: 'gated',
            summary: 'Condition gate evaluated false — stopped run',
            durationMs: 0,
          });
          return 'gated';
        }
        ctx.steps.push({
          stepId: step.id,
          kind: 'condition',
          status: ctx.flow.dryRun ? 'dry-run' : 'ok',
          summary: 'Condition gate passed',
          durationMs: 0,
        });
        continue;
      }

      const branch = passed ? 'then' : 'else';
      const branchSteps = passed ? (step.then ?? []) : (step.else ?? []);
      ctx.steps.push({
        stepId: step.id,
        kind: 'condition',
        status: ctx.flow.dryRun ? 'dry-run' : 'ok',
        summary: `Condition evaluated ${passed ? 'true' : 'false'} → ${branch}`,
        branch,
        durationMs: 0,
      });

      const subOutcome = walkSteps(branchSteps, ctx);
      if (subOutcome !== 'completed') {
        // If paused inside a branch, attach any remaining outer steps to the checkpoint
        if (subOutcome === 'paused' && remaining.length > 0 && ctx.checkpoints.length > 0) {
          const lastCp = ctx.checkpoints[ctx.checkpoints.length - 1];
          lastCp.remainingSteps = [...lastCp.remainingSteps, ...remaining];
        }
        return subOutcome;
      }
      continue;
    }

    if (step.kind === 'cancel') {
      if (!ctx.flow.dryRun) {
        ctx.cancelIdentifiers.push(step.identifier);
      }
      ctx.steps.push({
        stepId: step.id,
        kind: 'cancel',
        status: ctx.flow.dryRun ? 'dry-run' : 'ok',
        summary: `Cancel scheduled "${step.identifier}"`,
        durationMs: 0,
      });
      continue;
    }

    if (step.kind === 'command') {
      const sensitiveSet = new Set(step.sensitiveFields ?? []);
      const resolvedInput: Record<string, unknown> = {};
      const secretRefs: Record<string, string> = {};

      for (const [key, val] of Object.entries(step.input)) {
        const res = renderInputValue(val, ctx.data, ctx.trustedRoots, sensitiveSet.has(key));
        if (!res.ok) {
          ctx.steps.push({
            stepId: step.id,
            kind: 'command',
            status: 'failed',
            summary: `Blocked ${step.targetCapability}.${step.action}: ${res.reason}`,
            error: res.reason,
            durationMs: ctx.now - stepStart,
          });
          return 'failed';
        }
        resolvedInput[key] = res.value;
        for (const sk of res.secretKeys) {
          secretRefs[sk] = sk;
        }
      }

      const commandId = ctx.createId();
      const command: Command = {
        id: commandId,
        targetCapability: step.targetCapability,
        action: step.action,
        ...(step.space ? { space: step.space } : {}),
        input: resolvedInput,
        ...(Object.keys(secretRefs).length > 0 ? { secretRefs } : {}),
        ...(step.awaitReply ? { awaitReply: step.awaitReply } : {}),
      };

      if (ctx.flow.dryRun) {
        ctx.steps.push({
          stepId: step.id,
          kind: 'command',
          status: 'dry-run',
          commandId,
          summary: `[dry-run] Would run ${step.targetCapability}.${step.action}`,
          durationMs: 0,
        });
        continue;
      }

      // Deferred command via relative delay
      if (step.delay && step.delay.amount > 0) {
        const delayMs = delayToMs(step.delay);
        const dueAt = ctx.now + delayMs;
        const checkpointId = ctx.createId();
        ctx.checkpoints.push({
          id: checkpointId,
          flowId: ctx.flow.id,
          runId: ctx.runId,
          contextId: ctx.flow.contextId,
          reason: 'delay',
          identifier: step.delay.identifier,
          pendingCommand: command,
          remainingSteps: [],
          dueAt,
          ...(step.delay.expireAfterMs ? { expiresAt: dueAt + step.delay.expireAfterMs } : {}),
          data: structuredClone(ctx.data),
          trustedRoots: [...ctx.trustedRoots],
          createdAt: ctx.now,
        });
        ctx.steps.push({
          stepId: step.id,
          kind: 'command',
          status: 'paused',
          commandId,
          checkpointId,
          summary: `Scheduled ${step.targetCapability}.${step.action} in ${step.delay.amount} ${step.delay.unit}`,
          durationMs: 0,
        });
        continue;
      }

      // Immediate command dispatch
      ctx.commands.push(command);

      // If awaiting async reply from a Space/app participant, checkpoint remaining steps
      if (step.awaitReply) {
        const checkpointId = ctx.createId();
        ctx.checkpoints.push({
          id: checkpointId,
          flowId: ctx.flow.id,
          runId: ctx.runId,
          contextId: ctx.flow.contextId,
          reason: 'awaitReply',
          awaitingCommandId: commandId,
          bindReplyAs: step.bindAs,
          remainingSteps: remaining,
          expiresAt: ctx.now + step.awaitReply.timeoutMs,
          data: structuredClone(ctx.data),
          trustedRoots: [...ctx.trustedRoots],
          createdAt: ctx.now,
        });
        ctx.steps.push({
          stepId: step.id,
          kind: 'command',
          status: 'paused',
          commandId,
          checkpointId,
          summary: `Dispatched ${step.targetCapability}.${step.action} (awaiting reply)`,
          durationMs: 0,
        });
        return 'paused';
      }

      ctx.steps.push({
        stepId: step.id,
        kind: 'command',
        status: 'ok',
        commandId,
        summary: `Dispatched ${step.targetCapability}.${step.action}`,
        durationMs: 0,
      });
    }
  }

  return 'completed';
}

// ── Public Pure Entrypoints ──

/**
 * Purely execute a Flow against an incoming Event.
 * Never performs I/O — returns Commands to dispatch, Checkpoints to persist,
 * cancel identifiers, and a structured RunTrace.
 */
export function executeFlow(flow: Flow, event: Event, env: EngineEnv = {}): ExecutionResult {
  const now = env.now ?? Date.now();
  const createId = env.createId ?? defaultCreateId;
  const runId = createId();

  const projectedPayload = projectEventPayload(event, flow.trigger.exposePayloadKeys);
  const data: RunData = {
    event: {
      id: event.id,
      type: event.type,
      source: event.source,
      author: event.author,
      space: event.space,
      title: event.title,
      body: event.body,
      urgency: event.urgency,
      hops: event.hops,
      payload: projectedPayload,
      createdAt: event.createdAt,
    },
    trigger: projectedPayload,
    device: env.device ?? {},
    inputs: env.inputs ?? {},
    time: buildTimeSnapshot(now),
  };

  const trustedRoots = new Set<string>(['device', 'inputs', 'time']);
  if (event.trust === 'trusted') {
    trustedRoots.add('event');
    trustedRoots.add('trigger');
  }

  const ctx: WalkContext = {
    flow,
    runId,
    now,
    createId,
    data,
    trustedRoots,
    commands: [],
    checkpoints: [],
    cancelIdentifiers: [],
    steps: [],
  };

  if (event.hops > MAX_EVENT_HOPS) {
    return {
      status: 'failed',
      commands: [],
      checkpoints: [],
      cancelIdentifiers: [],
      trace: {
        id: runId,
        flowId: flow.id,
        flowName: flow.name,
        contextId: flow.contextId,
        triggerEvent: {
          id: event.id,
          type: event.type,
          source: event.source,
          author: event.author,
          trust: event.trust,
          createdAt: event.createdAt,
        },
        status: 'failed',
        dryRun: flow.dryRun,
        startedAt: now,
        finishedAt: now,
        steps: [
          {
            stepId: '__hop_guard',
            kind: 'condition',
            status: 'failed',
            summary: `Event exceeded MAX_EVENT_HOPS (${MAX_EVENT_HOPS})`,
            error: `Hop count ${event.hops} exceeds limit ${MAX_EVENT_HOPS}`,
            durationMs: 0,
          },
        ],
      },
    };
  }

  const outcome = walkSteps(flow.steps, ctx);
  const status: RunStatus = flow.dryRun && outcome === 'completed' ? 'dry-run' : outcome;

  return {
    status,
    commands: ctx.commands,
    checkpoints: ctx.checkpoints,
    cancelIdentifiers: ctx.cancelIdentifiers,
    trace: {
      id: runId,
      flowId: flow.id,
      flowName: flow.name,
      contextId: flow.contextId,
      triggerEvent: {
        id: event.id,
        type: event.type,
        source: event.source,
        author: event.author,
        trust: event.trust,
        createdAt: event.createdAt,
      },
      status,
      dryRun: flow.dryRun,
      startedAt: now,
      finishedAt: now,
      steps: ctx.steps,
    },
  };
}

/**
 * Purely resume a persisted Checkpoint — either because a `delay` became due
 * or because a correlated `replyEvent` arrived for an `awaitReply` command.
 */
export function resumeCheckpoint(
  flow: Flow,
  checkpoint: Checkpoint,
  replyEvent?: Event,
  env: EngineEnv = {},
): ExecutionResult {
  const now = env.now ?? Date.now();
  const createId = env.createId ?? defaultCreateId;

  const data: RunData = structuredClone(checkpoint.data);
  data.time = buildTimeSnapshot(now);
  if (env.device) data.device = env.device;

  const trustedRoots = new Set<string>(checkpoint.trustedRoots);
  trustedRoots.add('time');
  trustedRoots.add('device');

  const ctx: WalkContext = {
    flow,
    runId: checkpoint.runId,
    now,
    createId,
    data,
    trustedRoots,
    commands: [],
    checkpoints: [],
    cancelIdentifiers: [],
    steps: [],
  };

  if (checkpoint.reason === 'delay' && checkpoint.pendingCommand) {
    ctx.commands.push(checkpoint.pendingCommand);
    ctx.steps.push({
      stepId: checkpoint.id,
      kind: 'command',
      status: 'ok',
      commandId: checkpoint.pendingCommand.id,
      summary: `Dispatched delayed ${checkpoint.pendingCommand.targetCapability}.${checkpoint.pendingCommand.action}`,
      durationMs: 0,
    });
  }

  if (checkpoint.reason === 'awaitReply' && replyEvent) {
    if (checkpoint.bindReplyAs) {
      data[checkpoint.bindReplyAs] = replyEvent.payload;
      if (replyEvent.trust === 'trusted') {
        trustedRoots.add(checkpoint.bindReplyAs);
      } else {
        trustedRoots.delete(checkpoint.bindReplyAs);
      }
    }
    data.reply = replyEvent.payload;
    if (replyEvent.trust === 'trusted') {
      trustedRoots.add('reply');
    } else {
      trustedRoots.delete('reply');
    }
  }

  const outcome = walkSteps(checkpoint.remainingSteps, ctx);

  return {
    status: outcome,
    commands: ctx.commands,
    checkpoints: ctx.checkpoints,
    cancelIdentifiers: ctx.cancelIdentifiers,
    trace: {
      id: createId(),
      flowId: flow.id,
      flowName: flow.name,
      contextId: flow.contextId,
      triggerEvent: replyEvent
        ? {
            id: replyEvent.id,
            type: replyEvent.type,
            source: replyEvent.source,
            author: replyEvent.author,
            trust: replyEvent.trust,
            createdAt: replyEvent.createdAt,
          }
        : {
            id: checkpoint.id,
            type: 'checkpoint.resumed',
            source: 'local-flow',
            author: 'self',
            trust: 'trusted',
            createdAt: new Date(now).toISOString(),
          },
      status: outcome,
      dryRun: false,
      startedAt: now,
      finishedAt: now,
      steps: ctx.steps,
    },
  };
}
