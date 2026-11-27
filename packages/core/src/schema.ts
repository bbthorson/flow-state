import { z } from 'zod';
import type { Block, Capability, Checkpoint, Command, Context, Event, Flow, FlowStep } from './primitives';

/**
 * Trust-boundary Zod schemas for all 7 Flow State vNext primitives.
 * Everything arriving from another DID, a Space, a Hub inbox, or Vault import
 * MUST pass through these parsers before touching RuntimeHost or UI.
 */

export const TrustLevelSchema = z.enum(['trusted', 'untrusted']);

export const SecretRefSchema = z.object({
  name: z.string().min(1),
  label: z.string().optional(),
  description: z.string().optional(),
  required: z.boolean().optional(),
});

export const FieldSchemaZ = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean', 'enum', 'secret', 'url']),
  description: z.string().optional(),
  required: z.boolean().optional(),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  options: z.array(z.string()).optional(),
  sensitive: z.boolean().optional(),
});

export const EventSchemaZ = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  source: z.enum(['device', 'block', 'manual', 'deep-link', 'local-flow', 'space', 'hub']),
  author: z.string().min(1),
  space: z.string().optional(),
  replyTo: z.string().optional(),
  trust: TrustLevelSchema,
  title: z.string().optional(),
  body: z.string().optional(),
  urgency: z.enum(['low', 'normal', 'high']).optional(),
  hops: z.number().int().min(0).default(0),
  payload: z.record(z.unknown()).default({}),
  createdAt: z.string().min(1),
  expiresAt: z.string().optional(),
});

export const CapabilityEventSchemaZ = z.object({
  type: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  fields: z.array(FieldSchemaZ).default([]),
});

export const CapabilityCommandSchemaZ = z.object({
  action: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  inputs: z.array(FieldSchemaZ).default([]),
  outputs: z.array(FieldSchemaZ).optional(),
});

export const CapabilitySchemaZ = z.object({
  id: z.string().min(1),
  kind: z.enum(['device', 'app', 'bridge', 'system']),
  name: z.string().min(1),
  description: z.string().optional(),
  did: z.string().optional(),
  emits: z.array(CapabilityEventSchemaZ).default([]),
  accepts: z.array(CapabilityCommandSchemaZ).default([]),
  runtimes: z.array(z.enum(['browser', 'service-worker', 'hub', 'remote-did'])).default(['browser']),
  permissions: z.array(z.string()).default([]),
});

export const CommandSchemaZ = z.object({
  id: z.string().min(1),
  targetCapability: z.string().min(1),
  action: z.string().min(1),
  space: z.string().optional(),
  input: z.record(z.unknown()).default({}),
  secretRefs: z.record(z.string()).optional(),
  awaitReply: z.object({ timeoutMs: z.number().positive() }).optional(),
});

export const AssertionSchemaZ = z.object({
  field: z.string().min(1),
  operator: z
    .enum([
      'eq',
      'neq',
      'gt',
      'gte',
      'lt',
      'lte',
      'contains',
      'notContains',
      'startsWith',
      'endsWith',
      'matches',
      'exists',
      'notExists',
      'in',
    ])
    .optional(),
  value: z.string().optional(),
  values: z.array(z.string()).optional(),
});

export const EventMatcherSchemaZ = z.object({
  eventType: z.string().min(1),
  source: z.enum(['device', 'block', 'manual', 'deep-link', 'local-flow', 'space', 'hub']).optional(),
  authors: z.array(z.string()).optional(),
  exposePayloadKeys: z.array(z.string()).optional(),
  where: z.array(AssertionSchemaZ).optional(),
  edgeTriggered: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
});

export const RelativeDelaySchemaZ = z.object({
  amount: z.number().positive(),
  unit: z.enum(['seconds', 'minutes', 'hours']),
  expireAfterMs: z.number().positive().optional(),
  identifier: z.string().optional(),
});

export const FlowStepSchemaZ: z.ZodType<FlowStep, z.ZodTypeDef, unknown> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('variable'),
      id: z.string().min(1),
      name: z.string().min(1),
      value: z.string().optional(),
      secret: z.boolean().optional(),
      note: z.string().optional(),
      preserveOnFork: z.boolean().optional(),
    }),
    z.object({
      kind: z.literal('condition'),
      id: z.string().min(1),
      mode: z.enum(['all', 'any']).optional(),
      assertions: z.array(AssertionSchemaZ),
      then: z.array(FlowStepSchemaZ).optional(),
      else: z.array(FlowStepSchemaZ).optional(),
    }),
    z.object({
      kind: z.literal('command'),
      id: z.string().min(1),
      bindAs: z.string().optional(),
      targetCapability: z.string().min(1),
      action: z.string().min(1),
      space: z.string().optional(),
      input: z.record(z.unknown()).default({}),
      sensitiveFields: z.array(z.string()).optional(),
      delay: RelativeDelaySchemaZ.optional(),
      awaitReply: z.object({ timeoutMs: z.number().positive() }).optional(),
    }),
    z.object({
      kind: z.literal('cancel'),
      id: z.string().min(1),
      identifier: z.string().min(1),
    }),
  ]),
);

export const FlowSchemaZ = z.object({
  id: z.string().min(1),
  contextId: z.string().min(1).default('personal'),
  name: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  trigger: EventMatcherSchemaZ,
  inputs: z.array(FieldSchemaZ).default([]),
  secretRefs: z.array(SecretRefSchema).optional(),
  steps: z.array(FlowStepSchemaZ).default([]),
  active: z.boolean().default(false),
  dryRun: z.boolean().default(false),
  executionTarget: z.enum(['device', 'hub']).default('device'),
  forkedFrom: z.string().optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().optional(),
});

export const ParticipantSchemaZ = z.object({
  did: z.string().min(1),
  kind: z.enum(['person', 'app', 'bridge']),
  label: z.string().optional(),
  handle: z.string().optional(),
  role: z.enum(['owner', 'member', 'writer']),
  addedAt: z.string().min(1),
});

export const ContextSchemaZ = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(['personal', 'context', 'group']),
  description: z.string().optional(),
  spaceUri: z.string().optional(),
  participants: z.array(ParticipantSchemaZ).default([]),
  pinnedFlowIds: z.array(z.string()).default([]),
  createdAt: z.string().min(1),
});

export const BlockSchemaZ = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    kind: z.enum(['focus', 'care', 'triage']),
    startMin: z.number().int().min(0).max(1439),
    endMin: z.number().int().min(1).max(1440),
    days: z.array(z.number().int().min(0).max(6)).optional(),
    contextId: z.string().optional(),
  })
  .refine((b) => b.endMin > b.startMin, { message: 'endMin must be greater than startMin' });

export const CheckpointSchemaZ = z.object({
  id: z.string().min(1),
  flowId: z.string().min(1),
  runId: z.string().min(1),
  contextId: z.string().min(1),
  reason: z.enum(['delay', 'awaitReply']),
  identifier: z.string().optional(),
  remainingSteps: z.array(FlowStepSchemaZ).default([]),
  pendingCommand: CommandSchemaZ.optional(),
  bindReplyAs: z.string().optional(),
  dueAt: z.number().optional(),
  awaitingCommandId: z.string().optional(),
  expiresAt: z.number().optional(),
  data: z.record(z.unknown()).default({}),
  trustedRoots: z.array(z.string()).default([]),
  createdAt: z.number(),
});

// ── Safe Parse Helpers ──

export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

function wrap<T>(result: z.SafeParseReturnType<unknown, T>): ParseResult<T> {
  if (result.success) return { ok: true, data: result.data };
  const msg = result.error.issues.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`).join('; ');
  return { ok: false, error: msg };
}

export const parseEvent = (raw: unknown): ParseResult<Event> => wrap(EventSchemaZ.safeParse(raw));
export const parseCapability = (raw: unknown): ParseResult<Capability> => wrap(CapabilitySchemaZ.safeParse(raw));
export const parseCommand = (raw: unknown): ParseResult<Command> => wrap(CommandSchemaZ.safeParse(raw));
export const parseFlow = (raw: unknown): ParseResult<Flow> => wrap(FlowSchemaZ.safeParse(raw));
export const parseContext = (raw: unknown): ParseResult<Context> => wrap(ContextSchemaZ.safeParse(raw));
export const parseBlock = (raw: unknown): ParseResult<Block> => wrap(BlockSchemaZ.safeParse(raw));
export const parseCheckpoint = (raw: unknown): ParseResult<Checkpoint> => wrap(CheckpointSchemaZ.safeParse(raw));
