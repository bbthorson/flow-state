import { v4 as uuidv4 } from 'uuid';
import type { ActionStep, Flow, FlowStep, VariableStep } from '@/types';
import { newStepId } from '@/lib/steps';

/**
 * One-way migration of v1 flows (`enabled`, flat `actions`, `parameters`,
 * `securityKey`) to the v2 step model. Used for persisted store state and for
 * vault files exported before v2.
 */

export function isV1Flow(value: unknown): boolean {
  return !!value && typeof value === 'object' && Array.isArray((value as any).actions) && !Array.isArray((value as any).steps);
}

/**
 * v1 gave meaning to only two roots: `secrets.*` and `params.*`. Everything
 * else was a top-level trigger key — including `{{time}}` from the TIME
 * trigger, which collides with v2's reserved `time` root. v2 namespaces
 * trigger data under `trigger` and exposes recipe blanks as variables by name.
 */
export function rewriteTemplate(str: string): string {
  return str.replace(/\{\{\s*(.*?)\s*\}\}/g, (_match, rawPath: string) => {
    const path = rawPath.trim();
    if (path.startsWith('params.')) return `{{${path.slice('params.'.length)}}}`;
    if (path.startsWith('secrets.')) return `{{${path}}}`;
    return `{{trigger.${path}}}`;
  });
}

function rewriteDeep<T>(value: T): T {
  if (typeof value === 'string') return rewriteTemplate(value) as T;
  if (Array.isArray(value)) return value.map((v) => rewriteDeep(v)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewriteDeep(v)])) as T;
  }
  return value;
}

export function migrateFlowV1(v1: any): Flow {
  const parameters: any[] = Array.isArray(v1.parameters) ? v1.parameters : [];

  const variables: VariableStep[] = parameters.map((p) => ({
    type: 'variable',
    id: newStepId(),
    name: String(p.key),
    kind: p.type,
    ...(p.type !== 'secret' && p.default !== undefined ? { value: String(p.default) } : {}),
    ...(p.label ? { label: String(p.label) } : {}),
    ...(p.description ? { note: String(p.description) } : {}),
    ...(p.required !== undefined ? { required: !!p.required } : {}),
  }));

  const actions: ActionStep[] = (v1.actions as any[]).map((a) => ({
    type: 'action',
    id: newStepId(),
    action: { type: a.type, details: rewriteDeep(a.details ?? {}) },
  }));

  const secrets: Record<string, string> = { ...(v1.secrets ?? {}) };
  if (typeof v1.securityKey === 'string' && v1.securityKey) secrets.securityKey = v1.securityKey;

  const steps: FlowStep[] = [...variables, ...actions];
  return {
    id: typeof v1.id === 'string' && v1.id ? v1.id : uuidv4(),
    name: String(v1.name ?? 'Untitled flow'),
    ...(v1.description ? { description: String(v1.description) } : {}),
    ...(Array.isArray(v1.tags) && v1.tags.length ? { tags: v1.tags } : {}),
    ...(v1.forkedFromUri ? { forkedFromUri: String(v1.forkedFromUri) } : {}),
    active: !!v1.enabled,
    dryRun: false,
    trigger: { type: v1.trigger?.type, details: { ...(v1.trigger?.details ?? {}) } },
    steps,
    ...(Object.keys(secrets).length ? { secrets } : {}),
    createdAt: new Date().toISOString(),
  };
}
