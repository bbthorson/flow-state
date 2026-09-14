import * as z from 'zod';
import { TRIGGER_TYPES, ACTION_TYPES } from '@/lib/flow-constants';
import type { TriggerType, ActionType } from '@/types';

/**
 * Runtime validation for `app.flowstate.flow` records.
 *
 * Discovery crawls the follow graph and reads records straight off other
 * people's PDSes. Nothing on that path is under our control: a record can be
 * any shape at all, whether through a bug in another client, a hand-written
 * record, or someone being deliberately awkward. Without a check here a single
 * bad record from one followed account takes out the whole Discover surface —
 * `FlowCard` calls `triggerType.replace(...)` and `actions.map(...)` — and an
 * installed one would throw inside `useFlowTriggerManager` on every sensor tick.
 *
 * Mirrors `src/lexicons/app/flowstate/`. Keep the two in step.
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
    url: z.string().url(),
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

export const flowRecordSchema = z.object({
  name: z.string().min(1).max(256),
  enabled: z.boolean(),
  securityKey: z.string().optional(),
  trigger: withTypedDetails(triggerTypeSchema, TRIGGER_DETAILS),
  actions: z.array(withTypedDetails(actionTypeSchema, ACTION_DETAILS)).min(1),
});

export type FlowRecord = z.infer<typeof flowRecordSchema>;

/**
 * Validate one record. Returns the parsed record, or `null` with the reason —
 * callers skip the bad one and keep going rather than failing the whole crawl.
 */
export function parseFlowRecord(
  value: unknown,
): { ok: true; record: FlowRecord } | { ok: false; reason: string } {
  const result = flowRecordSchema.safeParse(value);
  if (result.success) return { ok: true, record: result.data };

  const first = result.error.issues[0];
  const path = first.path.length ? first.path.join('.') : '(root)';
  return { ok: false, reason: `${path}: ${first.message}` };
}

/** The validated shape of one action's details, keyed by its type. */
export type ActionDetailsFor<T extends ActionType> = z.infer<(typeof ACTION_DETAILS)[T]>;

/**
 * Validate one action's details against its own type.
 *
 * Executors need concrete shapes (`executeWebhook` wants a `url`), and
 * `Record<string, any>` is not assignable to those — the call sites used to
 * paper over that with `as any`. Locally stored flows reach the executors
 * without ever passing through `parseFlowRecord` (vault imports, and anything
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
