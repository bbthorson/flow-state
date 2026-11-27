import {
  createPersonalContext,
  executeFlow,
  matchesEvent,
  parseBlock,
  parseContext,
  parseEvent,
  parseFlow,
  resumeCheckpoint,
  type Block,
  type Capability,
  type Checkpoint,
  type Command,
  type Context,
  type Event,
  type Flow,
  type Participant,
  type RunTrace,
} from '@flowstate/core';
import type { CapabilityAdapter } from '@flowstate/adapters';
import {
  migrateLegacyLocalStorage,
  type PersistedTriggerState,
  type RuntimeStorage,
  type VaultExportPayload,
} from './storage';

const MAX_RUNS = 200;
const MAX_STREAM_EVENTS = 150;
const TICK_INTERVAL_MS = 30_000;

export interface RuntimeSnapshot {
  initialized: boolean;
  contexts: Context[];
  activeContextId: string;
  activeBlockId: string | null;
  flows: Flow[];
  blocks: Block[];
  capabilities: Capability[];
  runs: RunTrace[];
  events: Event[];
  checkpoints: Checkpoint[];
  secretKeys: string[];
  hubUserId: string;
  deviceSnapshot: Record<string, unknown>;
  lastBackupTimestamp: number | null;
}

export interface RuntimeHostOptions {
  storage: RuntimeStorage;
  adapters?: CapabilityAdapter[];
  now?: () => number;
  legacyLocalStorageJson?: string | null;
  /** Disable background setInterval ticks (useful in deterministic unit tests). */
  disableTicker?: boolean;
}

function makeId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function findActiveBlock(blocks: Block[], nowMs: number): Block | undefined {
  const d = new Date(nowMs);
  const mins = d.getHours() * 60 + d.getMinutes();
  const dow = d.getDay();
  return blocks.find((b) => {
    const dayOk = !b.days || b.days.length === 0 || b.days.includes(dow);
    return dayOk && mins >= b.startMin && mins < b.endMin;
  });
}

/**
 * Headless Flow State Runtime Host.
 *
 * Owns persistence (IndexedDB / Memory / DO), the Event bus, persisted trigger
 * transition state, Checkpoint scheduling, Block-to-Context transitions, and
 * Tier-0 Secret resolution. Zero React dependencies.
 */
export class RuntimeHost {
  private storage: RuntimeStorage;
  private adapters = new Map<string, CapabilityAdapter>();
  private externalCapabilities = new Map<string, Capability>();
  private listeners = new Set<() => void>();
  private nowFn: () => number;
  private legacyJson: string | null;
  private disableTicker: boolean;
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  private snapshot: RuntimeSnapshot = {
    initialized: false,
    contexts: [],
    activeContextId: 'personal',
    activeBlockId: null,
    flows: [],
    blocks: [],
    capabilities: [],
    runs: [],
    events: [],
    checkpoints: [],
    secretKeys: [],
    hubUserId: '',
    deviceSnapshot: {},
    lastBackupTimestamp: null,
  };

  constructor(options: RuntimeHostOptions) {
    this.storage = options.storage;
    this.nowFn = options.now ?? (() => Date.now());
    this.legacyJson = options.legacyLocalStorageJson ?? null;
    this.disableTicker = options.disableTicker ?? false;

    for (const adapter of options.adapters ?? []) {
      this.adapters.set(adapter.manifest.id, adapter);
    }
  }

  // ── Subscription API (compatible with React `useSyncExternalStore`) ──

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): RuntimeSnapshot => this.snapshot;

  private emitSnapshot(patch: Partial<RuntimeSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const l of this.listeners) l();
  }

  private collectCapabilities(): Capability[] {
    return [
      ...[...this.adapters.values()].map((a) => a.manifest),
      ...this.externalCapabilities.values(),
    ];
  }

  private collectDeviceSnapshot(): Record<string, unknown> {
    const merged: Record<string, unknown> = {};
    for (const adapter of this.adapters.values()) {
      if (adapter.getSnapshot) {
        Object.assign(merged, adapter.getSnapshot());
      }
    }
    return merged;
  }

  // ── Lifecycle ──

  async start(): Promise<void> {
    if (this.legacyJson) {
      await migrateLegacyLocalStorage(this.storage, this.legacyJson);
    }

    let contexts = await this.storage.getAll<Context>('contexts');
    if (!contexts.some((c) => c.id === 'personal')) {
      const personal = createPersonalContext(new Date(this.nowFn()).toISOString());
      await this.storage.put('contexts', personal.id, personal);
      contexts = [personal, ...contexts];
    }

    const [flows, blocks, runs, events, checkpoints, lastBackupTimestamp, secretKeys, storedHubUserId] =
      await Promise.all([
        this.storage.getAll<Flow>('flows'),
        this.storage.getAll<Block>('blocks'),
        this.storage.getAll<RunTrace>('runs'),
        this.storage.getAll<Event>('events'),
        this.storage.getAll<Checkpoint>('checkpoints'),
        this.storage.get<number>('meta', 'lastBackupTimestamp'),
        this.storage.get<string[]>('meta', 'secretKeyIndex'),
        this.storage.get<string>('meta', 'hubUserId'),
      ]);

    let hubUserId = storedHubUserId;
    if (!hubUserId) {
      hubUserId = `dev-${makeId().replace(/-/g, '').slice(0, 12)}`;
      await this.storage.put('meta', 'hubUserId', hubUserId);
    }

    runs.sort((a, b) => b.startedAt - a.startedAt);
    events.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

    const activeBlock = findActiveBlock(blocks, this.nowFn());

    this.emitSnapshot({
      initialized: true,
      contexts,
      activeContextId: activeBlock?.contextId ?? 'personal',
      activeBlockId: activeBlock?.id ?? null,
      flows,
      blocks,
      capabilities: this.collectCapabilities(),
      runs,
      events,
      checkpoints,
      secretKeys: secretKeys ?? [],
      hubUserId,
      deviceSnapshot: this.collectDeviceSnapshot(),
      lastBackupTimestamp: lastBackupTimestamp ?? null,
    });

    for (const adapter of this.adapters.values()) {
      adapter.start?.((ev) => {
        this.emitSnapshot({ deviceSnapshot: this.collectDeviceSnapshot() });
        void this.ingestEvent(ev);
      });
    }

    await this.tick();

    if (!this.disableTicker) {
      this.tickTimer = setInterval(() => void this.tick(), TICK_INTERVAL_MS);
    }
  }

  stop(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    for (const adapter of this.adapters.values()) {
      adapter.stop?.();
    }
  }

  // ── Tick: Due Checkpoints + Day Block Transitions ──

  async tick(nowMs = this.nowFn()): Promise<void> {
    // 1. Check active Day Block transitions
    const currentBlock = findActiveBlock(this.snapshot.blocks, nowMs);
    const prevBlockId = this.snapshot.activeBlockId;
    if ((currentBlock?.id ?? null) !== prevBlockId) {
      if (prevBlockId) {
        const prevBlock = this.snapshot.blocks.find((b) => b.id === prevBlockId);
        if (prevBlock) {
          await this.ingestEvent({
            id: makeId(),
            type: 'block.exited',
            source: 'block',
            author: 'system.blocks',
            space: prevBlock.contextId ?? 'personal',
            trust: 'trusted',
            hops: 0,
            payload: { blockId: prevBlock.id, title: prevBlock.title, kind: prevBlock.kind },
            createdAt: new Date(nowMs).toISOString(),
          });
        }
      }

      this.emitSnapshot({
        activeBlockId: currentBlock?.id ?? null,
        ...(currentBlock?.contextId ? { activeContextId: currentBlock.contextId } : {}),
      });

      if (currentBlock) {
        await this.ingestEvent({
          id: makeId(),
          type: 'block.entered',
          source: 'block',
          author: 'system.blocks',
          space: currentBlock.contextId ?? 'personal',
          trust: 'trusted',
          hops: 0,
          payload: {
            blockId: currentBlock.id,
            title: currentBlock.title,
            kind: currentBlock.kind,
            contextId: currentBlock.contextId ?? 'personal',
          },
          createdAt: new Date(nowMs).toISOString(),
        });
      }
    }

    // 2. Process due or expired Checkpoints
    const checkpoints = [...this.snapshot.checkpoints];
    for (const cp of checkpoints) {
      if (cp.expiresAt !== undefined && nowMs > cp.expiresAt) {
        await this.removeCheckpoint(cp.id);
        continue;
      }
      if (cp.reason === 'delay' && cp.dueAt !== undefined && nowMs >= cp.dueAt) {
        await this.removeCheckpoint(cp.id);
        const flow = this.snapshot.flows.find((f) => f.id === cp.flowId);
        if (flow) {
          const result = resumeCheckpoint(flow, cp, undefined, {
            now: nowMs,
            device: this.collectDeviceSnapshot(),
          });
          await this.applyExecutionResult(flow, result);
        }
      }
    }
  }

  // ── Core Event Bus ──

  async ingestEvent(rawEvent: unknown): Promise<RunTrace[]> {
    const parsed = parseEvent(rawEvent);
    if (!parsed.ok) {
      console.warn('[flowstate/runtime] Dropped invalid event:', parsed.error);
      return [];
    }
    const event = parsed.data;
    const nowMs = this.nowFn();
    const traces: RunTrace[] = [];

    // Persist incoming Context Stream events (cards from apps/spaces/blocks)
    if (event.title || event.body || event.source === 'space' || event.source === 'hub') {
      await this.recordStreamEvent(event);
    }

    // 1. Check if this Event satisfies any `awaitReply` Checkpoint
    if (event.replyTo) {
      const waiting = this.snapshot.checkpoints.filter(
        (cp) => cp.reason === 'awaitReply' && cp.awaitingCommandId === event.replyTo,
      );
      for (const cp of waiting) {
        await this.removeCheckpoint(cp.id);
        if (cp.expiresAt !== undefined && nowMs > cp.expiresAt) continue;
        const flow = this.snapshot.flows.find((f) => f.id === cp.flowId);
        if (!flow) continue;
        const result = resumeCheckpoint(flow, cp, event, {
          now: nowMs,
          device: this.collectDeviceSnapshot(),
        });
        await this.applyExecutionResult(flow, result);
        traces.push(result.trace);
      }
    }

    // 2. Match & run active Flows
    for (const flow of this.snapshot.flows) {
      if (!flow.active) continue;
      if (event.space && flow.contextId !== 'personal' && flow.contextId !== event.space) {
        continue;
      }

      const prevState = await this.storage.get<PersistedTriggerState>('triggerState', flow.id);
      const matched = matchesEvent(flow.trigger, event, {
        now: nowMs,
        prevEvent: prevState?.lastEvent,
        device: this.collectDeviceSnapshot(),
      });

      // Persist last event per flow for edge-triggered transitions across reloads
      if (flow.trigger.eventType === '*' || flow.trigger.eventType === event.type) {
        await this.storage.put<PersistedTriggerState>('triggerState', flow.id, {
          ...prevState,
          lastEvent: event,
        });
      }

      if (!matched) continue;

      const result = executeFlow(flow, event, {
        now: nowMs,
        device: this.collectDeviceSnapshot(),
      });
      await this.applyExecutionResult(flow, result);
      traces.push(result.trace);
    }

    return traces;
  }

  /** Invoke a Flow directly as a pinned App Primitive with optional form inputs. */
  async runFlowManual(flowId: string, inputs: Record<string, unknown> = {}): Promise<RunTrace | null> {
    const flow = this.snapshot.flows.find((f) => f.id === flowId);
    if (!flow) return null;
    const nowMs = this.nowFn();
    const event: Event = {
      id: makeId(),
      type: 'user.manual.invoked',
      source: 'manual',
      author: 'self',
      space: flow.contextId,
      trust: 'trusted',
      hops: 0,
      payload: inputs,
      createdAt: new Date(nowMs).toISOString(),
    };
    const result = executeFlow(flow, event, {
      now: nowMs,
      device: this.collectDeviceSnapshot(),
      inputs,
    });
    await this.applyExecutionResult(flow, result);
    return result.trace;
  }

  /** Pure Live Dry-Run for the visual pipeline editor — zero side effects. */
  dryRunFlow(flow: Flow, mockEvent: Event, inputs: Record<string, unknown> = {}): RunTrace {
    const result = executeFlow({ ...flow, dryRun: true }, mockEvent, {
      now: this.nowFn(),
      device: this.collectDeviceSnapshot(),
      inputs,
    });
    return result.trace;
  }

  private async applyExecutionResult(flow: Flow, result: ReturnType<typeof executeFlow>): Promise<void> {
    // 1. Cancel requested checkpoint identifiers
    for (const ident of result.cancelIdentifiers) {
      const toCancel = this.snapshot.checkpoints.filter((cp) => cp.identifier === ident);
      for (const cp of toCancel) {
        await this.removeCheckpoint(cp.id);
      }
    }

    // 2. Persist new checkpoints
    for (const cp of result.checkpoints) {
      await this.storage.put('checkpoints', cp.id, cp);
    }
    if (result.checkpoints.length > 0) {
      this.emitSnapshot({ checkpoints: [...this.snapshot.checkpoints, ...result.checkpoints] });
    }

    // 3. Dispatch commands via registered CapabilityAdapters
    for (const command of result.commands) {
      const dispatchRes = await this.dispatchCommand(flow.id, command);
      const stepTrace = result.trace.steps.find((s) => s.commandId === command.id);
      if (stepTrace && !dispatchRes.ok) {
        stepTrace.status = 'failed';
        stepTrace.error = dispatchRes.message ?? 'Command dispatch failed';
        result.trace.status = 'failed';
      } else if (stepTrace && dispatchRes.message) {
        stepTrace.summary = `${stepTrace.summary} — ${dispatchRes.message}`;
      }
    }

    // 4. Record structured RunTrace
    await this.recordRunTrace(result.trace);
  }

  private async dispatchCommand(flowId: string, command: Command): Promise<{ ok: boolean; message?: string }> {
    const adapter = this.adapters.get(command.targetCapability);
    if (!adapter?.execute) {
      return { ok: false, message: `No adapter registered for "${command.targetCapability}"` };
    }
    const resolveSecret = async (key: string): Promise<string | undefined> => {
      // Check flow-scoped secret first, then global secret
      const scoped = await this.storage.get<string>('secrets', `${flowId}:${key}`);
      if (scoped !== undefined) return scoped;
      return this.storage.get<string>('secrets', key);
    };
    return adapter.execute(command, resolveSecret, (emitted) => {
      // Defer local event delivery to a fresh task so chains never recurse on the stack
      setTimeout(() => void this.ingestEvent(emitted), 0);
    });
  }

  private async recordRunTrace(trace: RunTrace): Promise<void> {
    await this.storage.put('runs', trace.id, trace);
    const next = [trace, ...this.snapshot.runs];
    if (next.length > MAX_RUNS) {
      const dropped = next.splice(MAX_RUNS);
      for (const old of dropped) {
        await this.storage.delete('runs', old.id);
      }
    }
    this.emitSnapshot({ runs: next });
  }

  private async recordStreamEvent(event: Event): Promise<void> {
    await this.storage.put('events', event.id, event);
    const next = [event, ...this.snapshot.events];
    if (next.length > MAX_STREAM_EVENTS) {
      const dropped = next.splice(MAX_STREAM_EVENTS);
      for (const old of dropped) {
        await this.storage.delete('events', old.id);
      }
    }
    this.emitSnapshot({ events: next });
  }

  private async removeCheckpoint(id: string): Promise<void> {
    await this.storage.delete('checkpoints', id);
    this.emitSnapshot({ checkpoints: this.snapshot.checkpoints.filter((c) => c.id !== id) });
  }

  // ── CRUD Intents (Contexts, Flows, Blocks, Secrets, Capabilities) ──

  setActiveContext(contextId: string): void {
    if (this.snapshot.contexts.some((c) => c.id === contextId)) {
      this.emitSnapshot({ activeContextId: contextId });
    }
  }

  async saveContext(context: Context): Promise<void> {
    await this.storage.put('contexts', context.id, context);
    const exists = this.snapshot.contexts.some((c) => c.id === context.id);
    const contexts = exists
      ? this.snapshot.contexts.map((c) => (c.id === context.id ? context : c))
      : [...this.snapshot.contexts, context];
    this.emitSnapshot({ contexts });
  }

  async inviteParticipant(contextId: string, participant: Participant, capability?: Capability): Promise<void> {
    const ctx = this.snapshot.contexts.find((c) => c.id === contextId);
    if (!ctx) return;
    const participants = [
      ...ctx.participants.filter((p) => p.did !== participant.did),
      participant,
    ];
    await this.saveContext({ ...ctx, participants });
    if (capability) {
      this.registerCapability(capability);
    }
  }

  async togglePinnedFlow(contextId: string, flowId: string): Promise<void> {
    const ctx = this.snapshot.contexts.find((c) => c.id === contextId);
    if (!ctx) return;
    const pinned = ctx.pinnedFlowIds.includes(flowId)
      ? ctx.pinnedFlowIds.filter((id) => id !== flowId)
      : [...ctx.pinnedFlowIds, flowId];
    await this.saveContext({ ...ctx, pinnedFlowIds: pinned });
  }

  async saveFlow(flow: Flow): Promise<void> {
    await this.storage.put('flows', flow.id, flow);
    const exists = this.snapshot.flows.some((f) => f.id === flow.id);
    const flows = exists
      ? this.snapshot.flows.map((f) => (f.id === flow.id ? flow : f))
      : [...this.snapshot.flows, flow];
    this.emitSnapshot({ flows });
  }

  async deleteFlow(flowId: string): Promise<void> {
    await this.storage.delete('flows', flowId);
    await this.storage.delete('triggerState', flowId);
    this.emitSnapshot({ flows: this.snapshot.flows.filter((f) => f.id !== flowId) });
  }

  async saveBlock(block: Block): Promise<void> {
    await this.storage.put('blocks', block.id, block);
    const exists = this.snapshot.blocks.some((b) => b.id === block.id);
    const blocks = exists
      ? this.snapshot.blocks.map((b) => (b.id === block.id ? block : b))
      : [...this.snapshot.blocks, block];
    this.emitSnapshot({ blocks });
  }

  async deleteBlock(blockId: string): Promise<void> {
    await this.storage.delete('blocks', blockId);
    this.emitSnapshot({ blocks: this.snapshot.blocks.filter((b) => b.id !== blockId) });
  }

  /** Store a Tier-0 local-only secret (never exported or synced). */
  async setSecret(key: string, value: string, flowId?: string): Promise<void> {
    const storageKey = flowId ? `${flowId}:${key}` : key;
    await this.storage.put('secrets', storageKey, value);
    if (!flowId && !this.snapshot.secretKeys.includes(key)) {
      const next = [...this.snapshot.secretKeys, key].sort((a, b) => a.localeCompare(b));
      await this.storage.put('meta', 'secretKeyIndex', next);
      this.emitSnapshot({ secretKeys: next });
    }
  }

  async deleteSecret(key: string, flowId?: string): Promise<void> {
    const storageKey = flowId ? `${flowId}:${key}` : key;
    await this.storage.delete('secrets', storageKey);
    if (!flowId && this.snapshot.secretKeys.includes(key)) {
      const next = this.snapshot.secretKeys.filter((k) => k !== key);
      await this.storage.put('meta', 'secretKeyIndex', next);
      this.emitSnapshot({ secretKeys: next });
    }
  }

  registerAdapter(adapter: CapabilityAdapter): void {
    this.adapters.set(adapter.manifest.id, adapter);
    this.emitSnapshot({ capabilities: this.collectCapabilities() });
  }

  registerCapability(capability: Capability): void {
    this.externalCapabilities.set(capability.id, capability);
    this.emitSnapshot({ capabilities: this.collectCapabilities() });
  }

  // ── Vault Backup & Restore (Tier-0 Secrets Excluded) ──

  async exportVault(): Promise<string> {
    const nowMs = this.nowFn();
    const payload: VaultExportPayload = {
      version: 3,
      exportedAt: new Date(nowMs).toISOString(),
      contexts: this.snapshot.contexts,
      flows: this.snapshot.flows,
      blocks: this.snapshot.blocks,
    };
    await this.storage.put('meta', 'lastBackupTimestamp', nowMs);
    this.emitSnapshot({ lastBackupTimestamp: nowMs });
    return JSON.stringify(payload, null, 2);
  }

  async importVault(json: string): Promise<{ ok: boolean; message: string }> {
    let parsed: any;
    try {
      parsed = JSON.parse(json);
    } catch {
      return { ok: false, message: 'Invalid JSON file' };
    }

    let importedFlows = 0;
    let importedContexts = 0;
    let importedBlocks = 0;

    if (Array.isArray(parsed?.contexts)) {
      for (const raw of parsed.contexts) {
        const res = parseContext(raw);
        if (res.ok) {
          await this.saveContext(res.data);
          importedContexts += 1;
        }
      }
    }

    if (Array.isArray(parsed?.flows)) {
      for (const raw of parsed.flows) {
        const res = parseFlow(raw);
        if (res.ok) {
          await this.saveFlow(res.data);
          importedFlows += 1;
        }
      }
    }

    if (Array.isArray(parsed?.blocks)) {
      for (const raw of parsed.blocks) {
        const res = parseBlock(raw);
        if (res.ok) {
          await this.saveBlock(res.data);
          importedBlocks += 1;
        }
      }
    }

    return {
      ok: true,
      message: `Imported ${importedContexts} contexts, ${importedFlows} flows, ${importedBlocks} blocks.`,
    };
  }
}
