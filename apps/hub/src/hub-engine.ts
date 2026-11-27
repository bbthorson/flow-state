import {
  executeFlow,
  matchesEvent,
  parseEvent,
  type Checkpoint,
  type Command,
  type Event,
  type Flow,
  type RunTrace,
} from '@flowstate/core';

export interface SenderTokenRecord {
  token: string;
  label: string;
  /** Optional list of flow IDs or Context IDs this sender is allowed to target. */
  allowedContexts?: string[];
  revoked: boolean;
  createdAt: string;
}

export interface PushSubscriptionRecord {
  id: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt: string;
}

export interface HubDeliverHooks {
  sendWebPush: (sub: PushSubscriptionRecord, event: Event) => Promise<void>;
  dispatchCommand: (command: Command) => Promise<{ ok: boolean; message?: string }>;
}

/**
 * Per-user Hub state machine (backed by a Cloudflare Durable Object in production,
 * or in-memory in unit tests).
 *
 * Responsibilities:
 * - Revocable per-sender HTTPS inbox (`POST /hub/e/:token`)
 * - Web Push fan-out to wake closed PWAs
 * - Opt-in Hub Runner executing `executionTarget === 'hub'` flows via `@flowstate/core`
 *   (and future bounded decision steps such as Cloudflare Clef)
 */
export class UserHubEngine {
  private tokens = new Map<string, SenderTokenRecord>();
  private pushSubs = new Map<string, PushSubscriptionRecord>();
  private hubFlows = new Map<string, Flow>();
  private checkpoints = new Map<string, Checkpoint>();
  private hooks: HubDeliverHooks;

  constructor(hooks: HubDeliverHooks) {
    this.hooks = hooks;
  }

  registerToken(record: SenderTokenRecord): void {
    this.tokens.set(record.token, record);
  }

  revokeToken(token: string): boolean {
    const rec = this.tokens.get(token);
    if (!rec) return false;
    rec.revoked = true;
    return true;
  }

  registerPushSubscription(sub: PushSubscriptionRecord): void {
    this.pushSubs.set(sub.id, sub);
  }

  removePushSubscription(id: string): void {
    this.pushSubs.delete(id);
  }

  upsertHubFlow(flow: Flow): void {
    if (flow.executionTarget === 'hub') {
      this.hubFlows.set(flow.id, flow);
    } else {
      this.hubFlows.delete(flow.id);
    }
  }

  getCheckpoints(): Checkpoint[] {
    return [...this.checkpoints.values()];
  }

  /**
   * Handle an external HTTPS ingress event (`POST /hub/e/:token`).
   * All external ingress events are marked `trust: 'untrusted'` at the boundary.
   */
  async handleHttpsIngress(
    token: string,
    body: Record<string, unknown>,
    nowMs = Date.now(),
  ): Promise<{ status: number; error?: string; pushed: number; traces: RunTrace[] }> {
    const rec = this.tokens.get(token);
    if (!rec || rec.revoked) {
      return { status: 401, error: 'Invalid or revoked sender token', pushed: 0, traces: [] };
    }

    const rawEvent: Event = {
      id: typeof body.id === 'string' ? body.id : `hub-${nowMs}`,
      type: typeof body.event === 'string' ? body.event : String(body.type ?? ''),
      source: 'hub',
      author: `hub-sender:${rec.label}`,
      space: typeof body.space === 'string' ? body.space : rec.allowedContexts?.[0],
      trust: 'untrusted',
      title: typeof body.title === 'string' ? body.title : undefined,
      body: typeof body.body === 'string' ? body.body : undefined,
      urgency: body.urgency === 'high' || body.urgency === 'low' ? body.urgency : 'normal',
      hops: 0,
      payload:
        body.data && typeof body.data === 'object'
          ? (body.data as Record<string, unknown>)
          : body.payload && typeof body.payload === 'object'
            ? (body.payload as Record<string, unknown>)
            : {},
      createdAt: new Date(nowMs).toISOString(),
    };

    const parsed = parseEvent(rawEvent);
    if (!parsed.ok) {
      return { status: 400, error: parsed.error, pushed: 0, traces: [] };
    }
    const event = parsed.data;

    if (rec.allowedContexts && event.space && !rec.allowedContexts.includes(event.space)) {
      return { status: 403, error: 'Sender token not scoped to target context', pushed: 0, traces: [] };
    }

    // 1. Fan-out via Web Push to wake closed devices
    let pushed = 0;
    for (const sub of this.pushSubs.values()) {
      await this.hooks.sendWebPush(sub, event);
      pushed += 1;
    }

    // 2. Run opt-in Hub-targeted flows using pure `@flowstate/core`
    const traces: RunTrace[] = [];
    for (const flow of this.hubFlows.values()) {
      if (!flow.active) continue;
      if (!matchesEvent(flow.trigger, event, { now: nowMs })) continue;

      const result = executeFlow(flow, event, { now: nowMs });
      for (const cp of result.checkpoints) {
        this.checkpoints.set(cp.id, cp);
      }
      for (const cmd of result.commands) {
        await this.hooks.dispatchCommand(cmd);
      }
      traces.push(result.trace);
    }

    return { status: 202, pushed, traces };
  }
}
