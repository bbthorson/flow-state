import { describe, expect, it } from 'vite-plus/test';
import worker, { UserHubDO, type HubWorkerEnv } from './worker';

function createMockEnv(): HubWorkerEnv {
  const storageMap = new Map<string, unknown>();
  const storage = {
    async get<T>(key: string) {
      return storageMap.get(key) as T | undefined;
    },
    async put<T>(key: string, value: T) {
      storageMap.set(key, value);
    },
  };
  const doInstances = new Map<string, UserHubDO>();

  return {
    ASSETS: {
      async fetch() {
        return new Response('<html>SPA</html>', { status: 200 });
      },
    },
    USER_HUB: {
      idFromName(name: string) {
        return name;
      },
      get(id: unknown) {
        const key = String(id);
        let inst = doInstances.get(key);
        if (!inst) {
          inst = new UserHubDO({ storage });
          doInstances.set(key, inst);
        }
        return inst;
      },
    },
  };
}

describe('apps/hub/src/worker.ts — Cloudflare Worker + UserHubDO lifecycle', () => {
  it('creates a scoped sender token, ingests HTTPS events, and revokes the token', async () => {
    const env = createMockEnv();

    // 1. Health check
    const health = await worker.fetch(new Request('https://flowstate.app/hub/health'), env);
    expect(health.status).toBe(200);

    // 2. Create a sender token for user `u1`
    const createRes = await worker.fetch(
      new Request('https://flowstate.app/hub/u/u1/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'u1.secret-abc',
          label: 'Home Assistant',
          allowedContexts: ['personal'],
        }),
      }),
      env,
    );
    expect(createRes.status).toBe(201);

    // 3. List active tokens
    const listRes = await worker.fetch(new Request('https://flowstate.app/hub/u/u1/tokens'), env);
    const listJson = (await listRes.json()) as { tokens: Array<{ token: string; label: string }> };
    expect(listJson.tokens).toHaveLength(1);
    expect(listJson.tokens[0]?.label).toBe('Home Assistant');

    // 4. External sender posts to HTTPS inbox
    const ingressRes = await worker.fetch(
      new Request('https://flowstate.app/hub/e/u1.secret-abc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'door.opened', title: 'Front door opened' }),
      }),
      env,
    );
    expect(ingressRes.status).toBe(202);

    // 5. Revoke sender token
    const delRes = await worker.fetch(
      new Request('https://flowstate.app/hub/u/u1/tokens/u1.secret-abc', { method: 'DELETE' }),
      env,
    );
    expect(delRes.status).toBe(200);

    // 6. Revoked token is immediately rejected
    const afterRevoke = await worker.fetch(
      new Request('https://flowstate.app/hub/e/u1.secret-abc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'door.opened' }),
      }),
      env,
    );
    expect(afterRevoke.status).toBe(401);

    // 7. Non-hub paths fall through to static ASSETS
    const spa = await worker.fetch(new Request('https://flowstate.app/'), env);
    expect(await spa.text()).toBe('<html>SPA</html>');
  });
});
