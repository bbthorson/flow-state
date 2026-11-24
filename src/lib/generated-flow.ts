import type { ActionType, Assertion, AssertionOperator, FlowStep, FlowTrigger, TriggerType } from '@/types';
import { ACTION_TYPES, TRIGGER_TYPES } from '@/lib/flow-constants';
import { MAX_DEPTH, RESERVED_ROOTS, newStepId } from '@/lib/steps';

/**
 * Turns whatever the on-device model returned into the form's flow shape.
 *
 * Small models are loose with structure, so this is forgiving where intent is
 * clear (an action given directly instead of wrapped in a step, the older flat
 * `actions` list, a bare `{{level}}`) and drops what it can't place (unknown
 * types, conditions without checks). The form's save-time validation still
 * has the final word.
 */

export interface GeneratedFlow {
  name: string;
  trigger: FlowTrigger;
  steps: FlowStep[];
}

const OPERATORS = new Set<AssertionOperator>([
  'eq', 'neq', 'contains', 'notContains', 'startsWith', 'endsWith', 'gt', 'gte', 'lt', 'lte', 'exists', 'notExists',
]);
const reserved = new Set<string>(RESERVED_ROOTS);

const isObject = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);

/** `{{level}}` → `{{trigger.level}}`; leaves reserved roots and variable names alone. */
function fixTemplates<T>(value: T, variables: ReadonlySet<string>): T {
  if (typeof value === 'string') {
    return value.replace(/\{\{\s*(.*?)\s*\}\}/g, (_m, raw: string) => {
      const path = raw.trim();
      const root = path.split('.')[0];
      return reserved.has(root) || variables.has(root) ? `{{${path}}}` : `{{trigger.${path}}}`;
    }) as T;
  }
  if (Array.isArray(value)) return value.map((v) => fixTemplates(v, variables)) as T;
  if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fixTemplates(v, variables)])) as T;
  return value;
}

function toAssertion(raw: unknown): Assertion | null {
  if (!isObject(raw) || typeof raw.field !== 'string' || !raw.field.trim()) return null;
  const operator = OPERATORS.has(raw.operator) ? (raw.operator as AssertionOperator) : 'eq';
  return {
    field: raw.field.trim(),
    operator,
    ...(raw.value !== undefined && raw.value !== null ? { value: String(raw.value) } : {}),
  };
}

function toStep(raw: unknown, depth: number): FlowStep | null {
  if (!isObject(raw)) return null;

  // An action given directly: { type: 'NOTIFICATION', details }.
  if (ACTION_TYPES.includes(raw.type)) {
    return { type: 'action', id: newStepId(), action: { type: raw.type as ActionType, details: isObject(raw.details) ? raw.details : {} } };
  }
  if (raw.type === 'action' && isObject(raw.action) && ACTION_TYPES.includes(raw.action.type)) {
    return {
      type: 'action',
      id: newStepId(),
      action: { type: raw.action.type as ActionType, details: isObject(raw.action.details) ? raw.action.details : {} },
    };
  }
  if (raw.type === 'condition') {
    const assertions = (Array.isArray(raw.assertions) ? raw.assertions : []).map(toAssertion).filter((a): a is Assertion => !!a);
    if (assertions.length === 0) return null;
    const branch = (Array.isArray(raw.then) || Array.isArray(raw.else)) && depth < MAX_DEPTH;
    return {
      type: 'condition',
      id: newStepId(),
      ...(raw.match === 'any' ? { match: 'any' as const } : {}),
      assertions: assertions.slice(0, 10),
      ...(branch ? { then: toSteps(raw.then, depth + 1), else: toSteps(raw.else, depth + 1) } : {}),
    };
  }
  return null;
}

function toSteps(raw: unknown, depth: number): FlowStep[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => toStep(s, depth)).filter((s): s is FlowStep => !!s);
}

export function normalizeGeneratedFlow(raw: unknown): GeneratedFlow | null {
  if (!isObject(raw) || !isObject(raw.trigger) || !TRIGGER_TYPES.includes(raw.trigger.type)) return null;

  const steps = toSteps(Array.isArray(raw.steps) ? raw.steps : raw.actions, 1);
  if (steps.length === 0) return null;

  const variables = new Set<string>();
  return {
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 256) : 'New Flow',
    trigger: { type: raw.trigger.type as TriggerType, details: isObject(raw.trigger.details) ? raw.trigger.details : {} },
    steps: fixTemplates(steps, variables),
  };
}

/** Pull the first JSON object out of a model reply (it may be wrapped in a code fence). */
export function extractJson(reply: string): unknown {
  const match = reply.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}
