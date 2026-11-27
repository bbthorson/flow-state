import { formatScalar, type Flow } from '@flowstate/core';
import {
  UserHubEngine,
  type PushSubscriptionRecord,
  type SenderTokenRecord,
} from './hub-engine';

interface DurableObjectStorageLike {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T = unknown>(key: string, value: T): Promise<void>;
}

interface DurableObjectStateLike {
  storage: DurableObjectStorageLike;
}

interface DurableObjectStubLike {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface DurableObjectNamespaceLike {
  idFromName(name: string): unknown;
  get(id: unknown): DurableObjectStubLike;
}

export interface HubWorkerEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
  USER_HUB?: DurableObjectNamespaceLike;
}

interface PersistedHubState {
  tokens: SenderTokenRecord[];
  pushSubs: PushSubscriptionRecord[];
  hubFlows: Flow[];
}

/**
 * Per-user Cloudflare Durable Object (`USER_HUB` binding in `wrangler.jsonc`).
 *
 * Isolates each user's sender tokens, Web Push subscriptions, and opt-in
 * `executionTarget: 'hub'` flows in their own SQLite-backed DO instance.
 */
export class UserHubDO {
  private state: DurableObjectStateLike;
  private engine: UserHubEngine | null = null;
  private persisted: PersistedHubState = { tokens: [], pushSubs: [], hubFlows: [] };

  constructor(state: DurableObjectStateLike) {
    this.state = state;
  }

  private async getEngine(): Promise<UserHubEngine> {
    if (this.engine) return this.engine;

    const saved = await this.state.storage.get<PersistedHubState>('hub_state');
    if (saved) {
      this.persisted = saved;
    }

    const engine = new UserHubEngine({
      sendWebPush: async (_sub, _event) => {
        // Encrypted RFC 8291 Web Push delivery is wired here once VAPID keys are configured.
      },
      dispatchCommand: async (_cmd) => ({ ok: true, message: 'Queued by Hub DO' }),
    });

    for (const t of this.persisted.tokens) engine.registerToken(t);
    for (const s of this.persisted.pushSubs) engine.registerPushSubscription(s);
    for (const f of this.persisted.hubFlows) engine.upsertHubFlow(f);

    this.engine = engine;
    return engine;
  }

  private async saveState(): Promise<void> {
    await this.state.storage.put('hub_state', this.persisted);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const engine = await this.getEngine();

    // POST /ingress/:token — external HTTPS sender event
    const ingressMatch = url.pathname.match(/^\/ingress\/([^/]+)$/);
    if (request.method === 'POST' && ingressMatch) {
      const token = decodeURIComponent(ingressMatch[1]!);
      let body: Record<string, unknown>;
      try {
        body = (await request.json()) as Record<string, unknown>;
      } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
      }
      const res = await engine.handleHttpsIngress(token, body);
      return Response.json(res, { status: res.status });
    }

    // GET /tokens — list active (non-revoked) sender tokens
    if (request.method === 'GET' && url.pathname === '/tokens') {
      return Response.json({
        tokens: this.persisted.tokens.filter((t) => !t.revoked),
      });
    }

    // POST /tokens — register a scoped per-sender HTTPS inbox token
    if (request.method === 'POST' && url.pathname === '/tokens') {
      const body = (await request.json()) as Partial<SenderTokenRecord>;
      const record: SenderTokenRecord = {
        token: formatScalar(body.token) || crypto.randomUUID(),
        label: formatScalar(body.label) || 'External Sender',
        allowedContexts: Array.isArray(body.allowedContexts) ? body.allowedContexts : undefined,
        revoked: false,
        createdAt: new Date().toISOString(),
      };
      engine.registerToken(record);
      this.persisted.tokens = [
        ...this.persisted.tokens.filter((t) => t.token !== record.token),
        record,
      ];
      await this.saveState();
      return Response.json(record, { status: 201 });
    }

    // DELETE /tokens/:token — revoke one sender token without affecting any other sender
    const deleteTokenMatch = url.pathname.match(/^\/tokens\/([^/]+)$/);
    if (request.method === 'DELETE' && deleteTokenMatch) {
      const token = decodeURIComponent(deleteTokenMatch[1]!);
      const revoked = engine.revokeToken(token);
      if (!revoked) {
        return Response.json({ error: 'Token not found' }, { status: 404 });
      }
      this.persisted.tokens = this.persisted.tokens.map((t) =>
        t.token === token ? { ...t, revoked: true } : t,
      );
      await this.saveState();
      return Response.json({ ok: true, revoked: token });
    }

    // POST /push/subscribe — register a device Web Push subscription
    if (request.method === 'POST' && url.pathname === '/push/subscribe') {
      const sub = (await request.json()) as PushSubscriptionRecord;
      engine.registerPushSubscription(sub);
      this.persisted.pushSubs = [
        ...this.persisted.pushSubs.filter((s) => s.id !== sub.id),
        sub,
      ];
      await this.saveState();
      return Response.json({ ok: true }, { status: 201 });
    }

    // POST /flows — sync an opt-in `executionTarget: 'hub'` flow
    if (request.method === 'POST' && url.pathname === '/flows') {
      const flow = (await request.json()) as Flow;
      engine.upsertHubFlow(flow);
      this.persisted.hubFlows = [
        ...this.persisted.hubFlows.filter((f) => f.id !== flow.id),
        ...(flow.executionTarget === 'hub' ? [flow] : []),
      ];
      await this.saveState();
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  }
}

/**
 * Cloudflare Worker entrypoint serving `/hub/*` API routes via `UserHubDO`
 * and falling through to static PWA assets for everything else.
 *
 * Token addressing convention: `<userId>.<secret>` routes directly to
 * `USER_HUB.idFromName(userId)` without requiring a global token lookup table.
 */
export default {
  async fetch(request: Request, env: HubWorkerEnv): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/hub/health') {
      return Response.json({ ok: true, service: 'flow-state-hub' });
    }

    // External HTTPS inbox: POST /hub/e/<userId>.<tokenSecret>
    const ingressMatch = url.pathname.match(/^\/hub\/e\/([^/]+)$/);
    if (request.method === 'POST' && ingressMatch) {
      if (!env.USER_HUB) {
        return Response.json(
          { error: 'Hub Durable Object not bound — deploy with wrangler.hub.jsonc' },
          { status: 503 },
        );
      }
      const fullToken = decodeURIComponent(ingressMatch[1]!);
      const dotIdx = fullToken.indexOf('.');
      if (dotIdx <= 0) {
        return Response.json({ error: 'Malformed sender token' }, { status: 401 });
      }
      const userId = fullToken.slice(0, dotIdx);
      const stub = env.USER_HUB.get(env.USER_HUB.idFromName(userId));
      return stub.fetch(
        new Request(`https://hub.internal/ingress/${encodeURIComponent(fullToken)}`, {
          method: 'POST',
          headers: request.headers,
          body: request.body,
        }),
      );
    }

    // User Hub management routes: /hub/u/<userId>/(tokens|push/subscribe|flows)
    const userMatch = url.pathname.match(/^\/hub\/u\/([^/]+)(\/.*)$/);
    if (userMatch) {
      if (!env.USER_HUB) {
        return Response.json(
          { error: 'Hub Durable Object not bound — deploy with wrangler.hub.jsonc' },
          { status: 503 },
        );
      }
      const userId = decodeURIComponent(userMatch[1]!);
      const subPath = userMatch[2]!;
      const stub = env.USER_HUB.get(env.USER_HUB.idFromName(userId));
      return stub.fetch(
        new Request(`https://hub.internal${subPath}`, {
          method: request.method,
          headers: request.headers,
          body: request.body,
        }),
      );
    }

    return env.ASSETS.fetch(request);
  },
};
