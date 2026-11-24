import * as z from 'zod';
import { TRIGGER_TYPES, ACTION_TYPES } from '@/lib/flow-constants';
import type { TriggerType, ActionType, FlowStep, FlowRecipe } from '@/types';
import { RESERVED_ROOTS, checkStepLimits } from '@/lib/steps';

/**
 * Runtime validation for automations (v2, `app.flowstate.automation`).
 *
 * Discovery crawls the follow graph and reads records straight off other
 * people's PDSes. Nothing on that path is under our control: a record can be
 * any shape at all, whether through a bug in another client, a hand-written
 * record, or someone being deliberately awkward. Without a check here a single
 * bad record from one followed account takes out the whole Discover surface —
 * `FlowCard` calls `triggerType.replace(...)` and `actions.map(...)` — and an
 * installed one would throw inside `useFlowTriggerManager` on every sensor tick.
 *
 * Records are converted from the lexicon's `$type` form into the local
 * `{ type, details }` form first (`@/lib/automation-record`), then validated
 * here. Vault imports and AI-generated flows go through the same check.
 *
 * Mirrors `docs/design/lexicons/` (v2). Keep the two in step.
 */

/** Keeps unknown keys. Stripping them would change DEEP_LINK matching, which
 *  compares every key of `trigger.details` against the incoming params. */
const bag = z.object({}).passthrough();

/**
 * Per-type detail shapes, from the trigger lexicons' own `required` lists.
 *
 * NOTE: TIME has no lexicon — it was added to `TriggerType` without one, so its
 * shape here follows `ScheduleTriggerDetails` in `src/types/`. Worth closing
 * that drift, since CLAUDE.md makes the lexicons the source of truth.
 */
const TRIGGER_DETAILS = {
  NATIVE_BATTERY: bag.extend({
    level: z.number().min(0).max(1).optional(),
    charging: z.boolean().optional(),
  }),
  NETWORK: bag.extend({
    online: z.boolean().optional(),
    ssid: z.string().optional(),
  }),
  GEOLOCATION: bag.extend({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    radius: z.number().positive(),
    event: z.enum(['ENTER', 'EXIT']),
  }),
  DEEP_LINK: bag.extend({ event: z.string().min(1) }),
  MANUAL: bag,
  IDLE: bag.extend({
    threshold: z.number().int().positive().optional(),
    detectScreen: z.boolean().optional(),
  }),
  DEVICE_MOTION: bag.extend({ gesture: z.enum(['SHAKE', 'FACE_DOWN', 'FACE_UP']) }),
  SCREEN_ORIENTATION: bag.extend({ orientation: z.enum(['portrait', 'landscape']) }),
  TIME: bag.extend({
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected HH:MM'),
    days: z.array(z.number().int().min(0).max(6)).optional(),
  }),
} satisfies Record<TriggerType, z.ZodTypeAny>;

/** Per-type action detail shapes, from the action lexicons' `required` lists. */
const ACTION_DETAILS = {
  WEBHOOK: bag.extend({
    url: z.string().refine(
      (val) => {
        try {
          new URL(val);
          return true;
        } catch {
          return val.includes('{{') && val.includes('}}');
        }
      },
      { message: 'Must be a valid URL or template URL' },
    ),
    method: z.string().optional(),
    headers: z.record(z.string(), z.string()).optional(),
    body: z.string().optional(),
  }),
  NOTIFICATION: bag.extend({
    title: z.string().min(1),
    body: z.string().optional(),
    icon: z.string().optional(),
  }),
  LOG: bag.extend({ message: z.string().optional() }),
  VIBRATION: bag.extend({
    duration: z.number().int().positive().optional(),
    pattern: z.array(z.number().int().nonnegative()).optional(),
  }),
  CLIPBOARD: bag.extend({ text: z.string() }),
  WEB_SHARE: bag.extend({
    title: z.string().optional(),
    text: z.string().optional(),
    url: z.string().optional(),
  }),
  WAKE_LOCK: bag.extend({ duration: z.number().int().positive().optional() }),
  SPEECH: bag.extend({
    text: z.string().min(1),
    rate: z.number().min(0.1).max(10).optional(),
    pitch: z.number().min(0).max(2).optional(),
    volume: z.number().min(0).max(1).optional(),
  }),
} satisfies Record<ActionType, z.ZodTypeAny>;

/**
 * The lexicon leaves the trigger/action unions open (`"closed": false`) for
 * forward compatibility, but this build can only *represent* what it knows: an
 * unrecognised type renders as `undefined` through TRIGGER_LABELS and can never
 * fire. Showing someone a flow we cannot run — or worse, letting them install
 * one and silently drop half its actions — is worse than omitting it, so
 * unknown types are rejected until this app learns them.
 */
const triggerTypeSchema = z.enum(TRIGGER_TYPES as [TriggerType, ...TriggerType[]]);
const actionTypeSchema = z.enum(ACTION_TYPES as [ActionType, ...ActionType[]]);

/** Validates `details` against its own `type` without rewriting it. */
function withTypedDetails<T extends string>(
  typeSchema: z.ZodType<T>,
  detailsByType: Record<T, z.ZodTypeAny>,
) {
  return z
    .object({ type: typeSchema, details: z.record(z.string(), z.unknown()) })
    .superRefine((value, ctx) => {
      const result = detailsByType[value.type as T].safeParse(value.details);
      if (result.success) return;
      for (const issue of result.error.issues) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['details', ...issue.path],
          message: issue.message,
        });
      }
    });
}

const triggerSchema = withTypedDetails(triggerTypeSchema, TRIGGER_DETAILS);
const actionSchema = withTypedDetails(actionTypeSchema, ACTION_DETAILS);

const stepId = z.string().min(1).max(32);
const comment = z.string().max(1024).optional();

const assertionSchema = z.object({
  field: z.string().min(1).max(256),
  operator: z
    .enum(['eq', 'neq', 'contains', 'notContains', 'startsWith', 'endsWith', 'gt', 'gte', 'lt', 'lte', 'exists', 'notExists'])
    .optional(),
  value: z.string().max(1024).optional(),
  comment,
});

const relativeDelaySchema = z.object({
  unit: z.enum(['ms', 's', 'm', 'h', 'd', 'w']),
  value: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('literal'), n: z.number().int().nonnegative() }),
    z.object({ kind: z.literal('template'), expr: z.string().max(512) }),
    z.object({ kind: z.literal('sum'), expr: z.string().max(512), offset: z.number().int() }),
  ]),
});

const reserved = new Set<string>(RESERVED_ROOTS);

export const stepSchema: z.ZodType<FlowStep> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({
      type: z.literal('condition'),
      id: stepId,
      match: z.enum(['all', 'any']).optional(),
      assertions: z.array(assertionSchema).min(1).max(10),
      then: z.array(stepSchema).max(25).optional(),
      else: z.array(stepSchema).max(25).optional(),
      comment,
    }),
    z.object({
      type: z.literal('variable'),
      id: stepId,
      name: z
        .string()
        .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'variable names are letters, digits and _')
        .max(64)
        .refine((n) => !reserved.has(n), 'variable name shadows a reserved root'),
      kind: z.enum(['string', 'number', 'boolean', 'secret']).optional(),
      value: z.string().max(2048).optional(),
      label: z.string().max(100).optional(),
      note: z.string().max(1024).optional(),
      required: z.boolean().optional(),
      preserveOnDuplication: z.boolean().optional(),
      comment,
    }),
    z.object({
      type: z.literal('action'),
      id: stepId,
      name: z.string().max(64).optional(),
      action: actionSchema,
      schedule: z
        .object({
          identifier: z.string().min(1).max(512),
          delay: relativeDelaySchema,
          expireAfter: relativeDelaySchema.optional(),
        })
        .optional(),
      comment,
    }),
    z.object({
      type: z.literal('cancelScheduled'),
      id: stepId,
      identifier: z.string().min(1).max(512),
      comment,
    }),
  ]),
) as z.ZodType<FlowStep>;

export const recipeSchema = z
  .object({
    name: z.string().min(1).max(256),
    description: z.string().max(1000).optional(),
    tags: z.array(z.string().min(1).max(30)).max(10).optional(),
    forkedFromUri: z.string().optional(),
    trigger: triggerSchema,
    // Locally a new flow starts empty; records need at least one step (checked
    // in parseAutomationRecord).
    steps: z.array(stepSchema).max(25),
  })
  .superRefine((value, ctx) => {
    const problem = checkStepLimits(value.steps as FlowStep[]);
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['steps'], message: problem });
  });

export type ParsedRecipe = Omit<FlowRecipe, 'id' | 'authorDid'>;

function firstIssue(error: z.ZodError): string {
  const first = error.issues[0];
  const path = first.path.length ? first.path.join('.') : '(root)';
  return `${path}: ${first.message}`;
}

/**
 * Validate one recipe (local form). Returns the parsed value, or the reason —
 * callers skip the bad one and keep going rather than failing the whole crawl.
 */
export function parseRecipe(value: unknown): { ok: true; recipe: ParsedRecipe } | { ok: false; reason: string } {
  const result = recipeSchema.safeParse(value);
  if (result.success) return { ok: true, recipe: result.data as ParsedRecipe };
  return { ok: false, reason: firstIssue(result.error) };
}

/** The validated shape of one action's details, keyed by its type. */
export type ActionDetailsFor<T extends ActionType> = z.infer<(typeof ACTION_DETAILS)[T]>;

/**
 * Validate one action's details against its own type.
 *
 * Executors need concrete shapes (`executeWebhook` wants a `url`), and
 * `Record<string, any>` is not assignable to those — the call sites used to
 * paper over that with `as any`. Locally stored flows reach the executors
 * without ever passing through `parseAutomationRecord` (vault imports, and anything
 * saved before that check existed), so the shape genuinely has to be checked
 * here rather than asserted.
 */
export function parseActionDetails<T extends ActionType>(
  type: T,
  details: Record<string, unknown>,
): { ok: true; details: ActionDetailsFor<T> } | { ok: false; reason: string } {
  const result = ACTION_DETAILS[type].safeParse(details ?? {});
  if (result.success) return { ok: true, details: result.data as ActionDetailsFor<T> };

  const first = result.error.issues[0];
  const path = first.path.length ? first.path.join('.') : '(root)';
  return { ok: false, reason: `${path}: ${first.message}` };
}
