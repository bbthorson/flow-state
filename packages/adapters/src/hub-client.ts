import type { Flow } from '@flowstate/core';

export interface HubSenderToken {
  token: string;
  label: string;
  allowedContexts?: string[];
  revoked: boolean;
  createdAt: string;
}

/**
 * Browser client for the optional self-hostable Flow State Cloudflare Hub.
 * Works with zero sign-in (using a locally generated device/user Hub ID)
 * or with a user's AT Protocol DID.
 */
export class HubClient {
  private baseUrl: string;
  private userId: string;
  private fetchImpl: typeof fetch;

  constructor(options: { baseUrl?: string; userId: string; fetchImpl?: typeof fetch }) {
    this.baseUrl = (options.baseUrl ?? '').replace(/\/$/, '');
    this.userId = options.userId;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
  }

  /** Build the external HTTPS inbox URL for a sender token. */
  inboxUrl(token: string, origin = typeof location !== 'undefined' ? location.origin : 'https://flowstate.app'): string {
    const base = this.baseUrl || origin;
    return `${base}/hub/e/${encodeURIComponent(token)}`;
  }

  async health(): Promise<boolean> {
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/hub/health`);
      return res.ok;
    } catch {
      return false;
    }
  }

  async listSenderTokens(): Promise<HubSenderToken[]> {
    const res = await this.fetchImpl(`${this.baseUrl}/hub/u/${encodeURIComponent(this.userId)}/tokens`);
    if (!res.ok) throw new Error(`Hub returned ${res.status}`);
    const data = (await res.json()) as { tokens?: HubSenderToken[] };
    return data.tokens ?? [];
  }

  async createSenderToken(label: string, allowedContexts?: string[]): Promise<HubSenderToken> {
    const secret =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID().replace(/-/g, '')
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    const fullToken = `${this.userId}.${secret}`;

    const res = await this.fetchImpl(`${this.baseUrl}/hub/u/${encodeURIComponent(this.userId)}/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: fullToken, label, allowedContexts }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error ?? `Hub returned ${res.status}`);
    }
    return (await res.json()) as HubSenderToken;
  }

  async revokeSenderToken(token: string): Promise<void> {
    const res = await this.fetchImpl(
      `${this.baseUrl}/hub/u/${encodeURIComponent(this.userId)}/tokens/${encodeURIComponent(token)}`,
      { method: 'DELETE' },
    );
    if (!res.ok) throw new Error(`Failed to revoke token (${res.status})`);
  }

  async syncHubFlow(flow: Flow): Promise<void> {
    const res = await this.fetchImpl(`${this.baseUrl}/hub/u/${encodeURIComponent(this.userId)}/flows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(flow),
    });
    if (!res.ok) throw new Error(`Failed to sync hub flow (${res.status})`);
  }
}
