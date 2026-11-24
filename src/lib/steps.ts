import type { ActionStep, Assertion, FlowStep, VariableStep, RelativeDelay } from '@/types';

/** Lexicon limits (app.flowstate.automation): 25 steps in total, nesting depth 3. */
export const MAX_STEPS = 25;
export const MAX_DEPTH = 3;

/** Placeholder roots the engine provides; variable names must not shadow them. */
export const RESERVED_ROOTS = ['trigger', 'device', 'event', 'time', 'self', 'secrets'] as const;

/**
 * Roots whose values are chosen by whoever fires the trigger (a deep link's
 * query string, an event's sender). They may reach bodies and text, never a
 * webhook URL or header.
 */
export const UNTRUSTED_ROOTS: ReadonlySet<string> = new Set(['trigger', 'event']);

const TID_CHARS = '234567abcdefghijklmnopqrstuvwxyz';
let lastTid = 0;

/**
 * A TID-shaped id (13 chars, base32-sortable, microsecond clock) so step ids
 * are valid as lexicon TIDs when published. Monotonic within this session.
 */
export function newStepId(): string {
  let micros = Date.now() * 1000;
  if (micros <= lastTid) micros = lastTid + 1;
  lastTid = micros;
  const clockId = Math.floor(Math.random() * 1024);
  // (micros << 10) | clockId, written as 11 chars of micros + 2 of clock id,
  // which avoids BigInt (the build targets ES2017).
  return base32(micros, 11) + base32(clockId, 2);
}

function base32(n: number, width: number): string {
  let out = '';
  for (let i = 0; i < width; i++) {
    out = TID_CHARS[n % 32] + out;
    n = Math.floor(n / 32);
  }
  return out;
}

/** Depth-first walk over every step, including those nested in branches. */
export function* walkSteps(steps: FlowStep[], depth = 1): Generator<{ step: FlowStep; depth: number }> {
  for (const step of steps) {
    yield { step, depth };
    if (step.type === 'condition') {
      if (step.then) yield* walkSteps(step.then, depth + 1);
      if (step.else) yield* walkSteps(step.else, depth + 1);
    }
  }
}

export function actionSteps(steps: FlowStep[]): ActionStep[] {
  return [...walkSteps(steps)].map((s) => s.step).filter((s): s is ActionStep => s.type === 'action');
}

export function variableSteps(steps: FlowStep[]): VariableStep[] {
  return [...walkSteps(steps)].map((s) => s.step).filter((s): s is VariableStep => s.type === 'variable');
}

/** Structural limits from the lexicon. Returns a reason, or null when fine. */
export function checkStepLimits(steps: FlowStep[]): string | null {
  let count = 0;
  for (const { step, depth } of walkSteps(steps)) {
    count++;
    if (depth > MAX_DEPTH) return `step ${step.id} is nested deeper than ${MAX_DEPTH}`;
  }
  if (count > MAX_STEPS) return `${count} steps (max ${MAX_STEPS})`;
  return null;
}

const UNIT_MS: Record<RelativeDelay['unit'], number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
};

/** Resolve a relative delay to milliseconds; null when a template doesn't yield a number. */
export function delayToMs(delay: RelativeDelay, render: (expr: string) => string): number | null {
  const v = delay.value;
  let amount: number;
  if (v.kind === 'literal') amount = v.n;
  else {
    amount = Number(render(v.expr));
    if (v.kind === 'sum') amount += v.offset;
  }
  if (!Number.isFinite(amount) || amount < 0) return null;
  return amount * UNIT_MS[delay.unit];
}

/** "5m", "2h" — for summaries. */
export function describeDelay(delay: RelativeDelay): string {
  const v = delay.value;
  const amount = v.kind === 'literal' ? String(v.n) : v.kind === 'template' ? v.expr : `${v.expr}+${v.offset}`;
  return `${amount}${delay.unit}`;
}

const OPERATOR_TEXT: Record<string, string> = {
  eq: '=',
  neq: '≠',
  contains: 'contains',
  notContains: 'does not contain',
  startsWith: 'starts with',
  endsWith: 'ends with',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  exists: 'is set',
  notExists: 'is not set',
};

export function describeAssertion(a: Assertion): string {
  const op = a.operator ?? 'eq';
  if (op === 'exists' || op === 'notExists') return `${a.field} ${OPERATOR_TEXT[op]}`;
  return `${a.field} ${OPERATOR_TEXT[op] ?? op} ${a.value ?? ''}`.trim();
}
