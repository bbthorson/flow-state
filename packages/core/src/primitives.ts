/**
 * Flow State vNext — The 7 Core Primitives
 *
 * Pure, framework-agnostic, zero-I/O types shared across:
 *   - Browser / PWA (Layer 4 + Layer 3)
 *   - Service Worker executor (Layer 3)
 *   - Cloudflare Hub Durable Object runner (Layer 3)
 *   - Capability & AT Protocol Space adapters (Layer 2)
 */

// ── 1. Trust & Secrets (Primitive 7) ──

export type TrustLevel = 'trusted' | 'untrusted';

export interface SecretRef {
  /** Logical secret key name referenced as `{{secrets.<name>}}`. */
  name: string;
  /** Human-readable label shown when prompting the user on a new device. */
  label?: string;
  /** Optional hint (e.g., "Home Assistant Long-Lived Token"). */
  description?: string;
  required?: boolean;
}

export type FieldType = 'string' | 'number' | 'boolean' | 'enum' | 'secret' | 'url';

export interface FieldSchema {
  name: string;
  label: string;
  type: FieldType;
  description?: string;
  required?: boolean;
  defaultValue?: string | number | boolean;
  options?: string[];
  /**
   * When true, this field is a security sink (e.g., Webhook URL or HTTP Header).
   * Untrusted template roots (`event.*`, external `trigger.*`, tainted variables)
   * are rejected at both UI authoring time and runtime.
   */
  sensitive?: boolean;
}

// ── 2. Event (Primitive 1) ──

export type EventSourceKind = 'device' | 'block' | 'manual' | 'deep-link' | 'local-flow' | 'space' | 'hub';

export interface Event {
  id: string;
  /** Dot-namespaced event type, e.g. `device.battery.changed`, `block.entered`, `linear.issue.assigned`. */
  type: string;
  source: EventSourceKind;
  /** Capability ID or author DID (e.g. `device.battery`, `self`, `did:plc:...`). */
  author: string;
  /** Context/Space ID if scoped to a Context or ATProto Space. */
  space?: string;
  /** Correlates this event as a reply to a prior Command ID. */
  replyTo?: string;
  /** Whether payload values may flow into sensitive command fields. */
  trust: TrustLevel;
  /** Optional display fields for brand-stripped Context Stream cards. */
  title?: string;
  body?: string;
  urgency?: 'low' | 'normal' | 'high';
  /** Event-chaining hop counter (bounded by MAX_EVENT_HOPS). */
  hops: number;
  /** Arbitrary structured payload. */
  payload: Record<string, unknown>;
  createdAt: string;
  expiresAt?: string;
}

// ── 3. Capability (Primitive 2) ──

export type RuntimeTarget = 'browser' | 'service-worker' | 'hub' | 'remote-did';
export type CapabilityKind = 'device' | 'app' | 'bridge' | 'system';

export interface EventSchema {
  type: string;
  label: string;
  description?: string;
  fields: FieldSchema[];
}

export interface CommandSchema {
  action: string;
  label: string;
  description?: string;
  inputs: FieldSchema[];
  /** Output fields returned when awaited via `awaitReply`. */
  outputs?: FieldSchema[];
}

export interface Capability {
  /** Stable identifier, e.g. `device.battery`, `local.webhook`, `did:plc:linear-bridge`. */
  id: string;
  kind: CapabilityKind;
  name: string;
  description?: string;
  /** AT Protocol DID for invited native apps or bridge DIDs. */
  did?: string;
  emits: EventSchema[];
  accepts: CommandSchema[];
  runtimes: RuntimeTarget[];
  permissions: string[];
}

// ── 4. Command (Primitive 3) ──

export interface Command {
  id: string;
  /** Capability ID or target app DID. */
  targetCapability: string;
  /** Action name declared in `Capability.accepts`. */
  action: string;
  /** Optional Space URI / Context ID when dispatching to a Space participant. */
  space?: string;
  /** Resolved (non-secret) input parameters. */
  input: Record<string, unknown>;
  /** Secret keys required by the adapter at dispatch time (resolved from Tier-0 vault only). */
  secretRefs?: Record<string, string>;
  /** If set, the engine checkpoints and resumes when an Event with `replyTo === id` arrives. */
  awaitReply?: {
    timeoutMs: number;
  };
}

// ── 5. Flow (Primitive 4) ──

export type AssertionOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'matches'
  | 'exists'
  | 'notExists'
  | 'in';

export interface Assertion {
  /** Dot-path into run data (e.g. `event.payload.level`, `device.battery.charging`, `time.hour`). */
  field: string;
  operator?: AssertionOperator;
  /** Expected value (may contain `{{...}}` templates). */
  value?: string;
  /** Optional list of values for `in` operator. */
  values?: string[];
}

export interface EventMatcher {
  /** Event type to match, or `*` for any event. */
  eventType: string;
  /** Optional source filter. */
  source?: EventSourceKind;
  /** Optional allowlist of author DIDs / capability IDs. */
  authors?: string[];
  /** Optional allowlist of payload keys exposed to templates as `event.payload.<key>`. */
  exposePayloadKeys?: string[];
  /** Optional predicate assertions that must pass for the trigger to match. */
  where?: Assertion[];
  /** Optional edge-trigger rule: only fire when `where` transitions from false -> true. */
  edgeTriggered?: boolean;
  /** Optional trigger configuration (e.g. geofence coordinates/radius, schedule time/days). */
  config?: Record<string, unknown>;
}

export interface RelativeDelay {
  amount: number;
  unit: 'seconds' | 'minutes' | 'hours';
  /** Drop the delayed checkpoint if it's still pending past this expiry. */
  expireAfterMs?: number;
  /** Optional identifier so a later `cancel` step can cancel this pending checkpoint. */
  identifier?: string;
}

export type FlowStep =
  | {
      kind: 'variable';
      id: string;
      name: string;
      /** Template expression (for computed variables) or literal default. */
      value?: string;
      /** When true, resolves from Tier-0 secrets store under `secrets.<name>`. */
      secret?: boolean;
      note?: string;
      preserveOnFork?: boolean;
    }
  | {
      kind: 'condition';
      id: string;
      mode?: 'all' | 'any';
      assertions: Assertion[];
      /** If omitted and condition fails, acts as a gate and ends the run cleanly (`gated`). */
      then?: FlowStep[];
      else?: FlowStep[];
    }
  | {
      kind: 'command';
      id: string;
      /** Optional name to bind command reply payload in run data (e.g. `{{issue.url}}`). */
      bindAs?: string;
      targetCapability: string;
      action: string;
      space?: string;
      /** Input templates (strings may include `{{...}}`). */
      input: Record<string, unknown>;
      /** Map of input field -> sensitive flag (validated against taint tracker). */
      sensitiveFields?: string[];
      /** Optional delay before dispatching this command. */
      delay?: RelativeDelay;
      /** Optional async reply wait (checkpoints until correlated `replyTo` event arrives). */
      awaitReply?: {
        timeoutMs: number;
      };
    }
  | {
      kind: 'cancel';
      id: string;
      identifier: string;
    };

export interface Flow {
  id: string;
  /** Context this flow belongs to (defaults to `'personal'`). */
  contextId: string;
  name: string;
  description?: string;
  tags?: string[];
  trigger: EventMatcher;
  /** Typed user-prompted inputs when invoked as a pinned app primitive. */
  inputs: FieldSchema[];
  /** Declared local-only secret references required by this flow. */
  secretRefs?: SecretRef[];
  steps: FlowStep[];
  active: boolean;
  dryRun: boolean;
  executionTarget: 'device' | 'hub';
  forkedFrom?: string;
  createdAt: string;
  updatedAt?: string;
}

// ── 6. Context & Day Block (Primitive 5) ──

export interface Participant {
  did: string;
  kind: 'person' | 'app' | 'bridge';
  label?: string;
  handle?: string;
  role: 'owner' | 'member' | 'writer';
  addedAt: string;
}

export interface Context {
  id: string;
  name: string;
  kind: 'personal' | 'context' | 'group';
  description?: string;
  /** AT Protocol Space URI once synced (undefined for local-only contexts). */
  spaceUri?: string;
  participants: Participant[];
  /** Flows pinned as quick-run app primitives in this Context's home view. */
  pinnedFlowIds: string[];
  createdAt: string;
}

export type BlockKind = 'focus' | 'care' | 'triage';

export interface Block {
  id: string;
  title: string;
  kind: BlockKind;
  /** Minutes from midnight (0..1439). */
  startMin: number;
  /** Minutes from midnight (1..1440, > startMin). */
  endMin: number;
  /** Days of week (0=Sun..6=Sat); omitted or empty means every day. */
  days?: number[];
  /** Context activated while this block is current. */
  contextId?: string;
}

// ── 7. Checkpoint & RunTrace (Primitive 6) ──

export type RunData = Record<string, unknown>;

export interface Checkpoint {
  id: string;
  flowId: string;
  runId: string;
  contextId: string;
  reason: 'delay' | 'awaitReply';
  /** Optional cancellation identifier (for `cancel` steps). */
  identifier?: string;
  /** Remaining sibling steps to execute upon resume. */
  remainingSteps: FlowStep[];
  /** For `delay`: the command to dispatch when `dueAt` is reached. */
  pendingCommand?: Command;
  /** For `awaitReply`: optional variable name to bind reply payload to. */
  bindReplyAs?: string;
  dueAt?: number;
  awaitingCommandId?: string;
  expiresAt?: number;
  /** Snapshot of non-secret run data at checkpoint time. */
  data: RunData;
  trustedRoots: string[];
  createdAt: number;
}

export type StepTraceStatus = 'ok' | 'skipped' | 'gated' | 'paused' | 'failed' | 'dry-run';

export interface StepTrace {
  stepId: string;
  kind: FlowStep['kind'];
  status: StepTraceStatus;
  summary: string;
  branch?: 'then' | 'else';
  commandId?: string;
  checkpointId?: string;
  error?: string;
  durationMs: number;
}

export type RunStatus = 'completed' | 'gated' | 'paused' | 'failed' | 'dry-run';

export interface RunTrace {
  id: string;
  flowId: string;
  flowName: string;
  contextId: string;
  triggerEvent: Pick<Event, 'id' | 'type' | 'source' | 'author' | 'trust' | 'createdAt'>;
  status: RunStatus;
  dryRun: boolean;
  startedAt: number;
  finishedAt: number;
  steps: StepTrace[];
}
