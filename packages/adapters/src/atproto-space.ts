import {
  parseCapability,
  parseEvent,
  type Capability,
  type Command,
  type Event,
} from '@flowstate/core';
import type { AdapterEmitFn, CapabilityAdapter, CommandDispatchResult } from './types';

export interface SpaceCommandRecord {
  commandId: string;
  targetDid: string;
  authorDid: string;
  spaceUri: string;
  action: string;
  input: Record<string, unknown>;
  createdAt: string;
}

/**
 * Transport abstraction for AT Protocol Spaces (Proposal 0016).
 * Isolates all Space wire-protocol details behind one interface so spec churn
 * never leaks into `@flowstate/core`, `@flowstate/runtime`, or the UI.
 */
export interface SpaceTransport {
  /** Fetch and return the raw `app.flowstate.capability` record published on a DID. */
  fetchCapabilityManifest(did: string): Promise<unknown>;
  /** Publish a capability manifest for a DID (used by bridges and tests). */
  publishCapabilityManifest?(did: string, manifest: Capability): Promise<void>;
  /** Write an `app.flowstate.command` record into a Context Space. */
  writeCommand(record: SpaceCommandRecord): Promise<void>;
  /** Write an `app.flowstate.event` record into a Context Space. */
  writeEvent(spaceUri: string, event: Event): Promise<void>;
  /** Subscribe to incoming `app.flowstate.event` records in a Context Space. */
  subscribeEvents(spaceUri: string, listener: (event: Event) => void): () => void;
  /** Subscribe to incoming `app.flowstate.command` records in a Context Space (for bridges). */
  subscribeCommands(spaceUri: string, listener: (cmd: SpaceCommandRecord) => void): () => void;
}

/**
 * In-memory Space transport for local testing and multi-participant simulation.
 */
export class InMemorySpaceTransport implements SpaceTransport {
  private manifests = new Map<string, Capability>();
  private eventListeners = new Map<string, Set<(ev: Event) => void>>();
  private commandListeners = new Map<string, Set<(cmd: SpaceCommandRecord) => void>>();

  async publishCapabilityManifest(did: string, manifest: Capability): Promise<void> {
    this.manifests.set(did, manifest);
  }

  async fetchCapabilityManifest(did: string): Promise<unknown> {
    return this.manifests.get(did);
  }

  async writeCommand(record: SpaceCommandRecord): Promise<void> {
    const listeners = this.commandListeners.get(record.spaceUri);
    if (!listeners) return;
    for (const l of listeners) l(record);
  }

  async writeEvent(spaceUri: string, event: Event): Promise<void> {
    const listeners = this.eventListeners.get(spaceUri);
    if (!listeners) return;
    for (const l of listeners) l(event);
  }

  subscribeEvents(spaceUri: string, listener: (event: Event) => void): () => void {
    let set = this.eventListeners.get(spaceUri);
    if (!set) {
      set = new Set();
      this.eventListeners.set(spaceUri, set);
    }
    set.add(listener);
    return () => set.delete(listener);
  }

  subscribeCommands(spaceUri: string, listener: (cmd: SpaceCommandRecord) => void): () => void {
    let set = this.commandListeners.get(spaceUri);
    if (!set) {
      set = new Set();
      this.commandListeners.set(spaceUri, set);
    }
    set.add(listener);
    return () => set.delete(listener);
  }
}

/**
 * Create a CapabilityAdapter for an invited App or Bridge DID in a Context Space.
 *
 * 1. Fetches and validates the invited DID's `app.flowstate.capability` manifest
 *    through the `@flowstate/core` Zod trust boundary.
 * 2. Dispatches Commands by writing `app.flowstate.command` records into the Space.
 * 3. Subscribes to incoming `app.flowstate.event` records from that DID in the Space
 *    and forwards them onto `RuntimeHost` as `trust: 'untrusted'` Events.
 */
export async function createSpaceParticipantAdapter(options: {
  userDid: string;
  appDid: string;
  spaceUri: string;
  transport: SpaceTransport;
}): Promise<{ ok: true; adapter: CapabilityAdapter } | { ok: false; error: string }> {
  const rawManifest = await options.transport.fetchCapabilityManifest(options.appDid);
  const parsed = parseCapability(rawManifest);
  if (!parsed.ok) {
    return { ok: false, error: `Invalid capability manifest from ${options.appDid}: ${parsed.error}` };
  }

  let unsub: (() => void) | null = null;

  const adapter: CapabilityAdapter = {
    manifest: parsed.data,
    start(emit: AdapterEmitFn) {
      unsub = options.transport.subscribeEvents(options.spaceUri, (rawEv) => {
        if (rawEv.author !== options.appDid) return;
        const checked = parseEvent({ ...rawEv, source: 'space', trust: 'untrusted' });
        if (checked.ok) emit(checked.data);
      });
    },
    stop() {
      unsub?.();
      unsub = null;
    },
    async execute(command: Command): Promise<CommandDispatchResult> {
      await options.transport.writeCommand({
        commandId: command.id,
        targetDid: options.appDid,
        authorDid: options.userDid,
        spaceUri: command.space ?? options.spaceUri,
        action: command.action,
        input: command.input,
        createdAt: new Date().toISOString(),
      });
      return { ok: true, message: `Dispatched to ${options.appDid} in Space` };
    },
  };

  return { ok: true, adapter };
}

/**
 * Reference Bridge DID host for non-ATProto apps (e.g., Calendar, Linear, Home Assistant).
 * Publishes its `app.flowstate.capability` manifest, listens to `app.flowstate.command`
 * records targeting its DID in a Context Space, executes the deterministic handler,
 * and writes back a correlated `replyTo` `app.flowstate.event`.
 */
export function createReferenceBridge(options: {
  manifest: Capability;
  spaceUri: string;
  transport: SpaceTransport;
  handleCommand: (
    cmd: SpaceCommandRecord,
  ) => Promise<{ eventType: string; title?: string; payload: Record<string, unknown> }>;
}): { start: () => Promise<void>; stop: () => void } {
  let unsub: (() => void) | null = null;

  return {
    async start() {
      const did = options.manifest.did ?? options.manifest.id;
      await options.transport.publishCapabilityManifest?.(did, options.manifest);
      unsub = options.transport.subscribeCommands(options.spaceUri, (cmd) => {
        if (cmd.targetDid !== did) return;
        void options.handleCommand(cmd).then(async (res) => {
          const replyEvent: Event = {
            id: `bridge-reply-${cmd.commandId}`,
            type: res.eventType,
            source: 'space',
            author: did,
            space: options.spaceUri,
            replyTo: cmd.commandId,
            trust: 'untrusted',
            ...(res.title ? { title: res.title } : {}),
            hops: 0,
            payload: res.payload,
            createdAt: new Date().toISOString(),
          };
          await options.transport.writeEvent(options.spaceUri, replyEvent);
        });
      });
    },
    stop() {
      unsub?.();
      unsub = null;
    },
  };
}
