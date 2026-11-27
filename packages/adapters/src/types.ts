import type { Capability, Command, Event } from '@flowstate/core';

export type AdapterEmitFn = (event: Event) => void;
export type SecretResolver = (key: string) => Promise<string | undefined>;

export interface CommandDispatchResult {
  ok: boolean;
  message?: string;
  output?: Record<string, unknown>;
}

/**
 * Uniform plugin contract for local device sensors, local actions,
 * AT Protocol Space bridges, and remote app DIDs.
 */
export interface CapabilityAdapter {
  readonly manifest: Capability;
  /** Start emitting Events onto the runtime bus (for sensors / Space listeners). */
  start?(emit: AdapterEmitFn): void;
  /** Clean up listeners/timers. */
  stop?(): void;
  /** Optional current state snapshot merged into `device.<key>`. */
  getSnapshot?(): Record<string, unknown>;
  /** Execute a Command targeting this capability. */
  execute?(command: Command, resolveSecret: SecretResolver, emit: AdapterEmitFn): Promise<CommandDispatchResult>;
}
