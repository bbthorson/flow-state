import { describe, it, expect, beforeEach, vi } from 'vitest';

// The whole point of the lazy-load is that a signed-out user never fetches the
// AT Protocol client, so these tests assert on whether getOAuthClient() is
// *called at all* rather than on what it returns.
// vi.hoisted, because vi.mock is lifted above ordinary top-level declarations.
const { getOAuthClient, bootedOnOAuthCallback, hasOAuthSessionToRestore } = vi.hoisted(() => ({
  getOAuthClient: vi.fn(),
  bootedOnOAuthCallback: vi.fn(() => false),
  hasOAuthSessionToRestore: vi.fn(() => false),
}));

vi.mock('@/lib/atproto', () => ({
  getOAuthClient,
  bootedOnOAuthCallback,
  hasOAuthSessionToRestore,
}));

import { useAuthStore } from './useAuthStore';

/** A client whose init() reports "no session to restore". */
function clientWithNoSession() {
  return { init: vi.fn().mockResolvedValue(undefined) };
}

describe('useAuthStore.init', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bootedOnOAuthCallback.mockReturnValue(false);
    hasOAuthSessionToRestore.mockReturnValue(false);
    localStorage.clear();
    useAuthStore.setState({
      did: null,
      handle: null,
      session: null,
      agent: null,
      loading: false,
      error: null,
    });
  });

  it('does not load the AT Protocol client for a signed-out user', async () => {
    await useAuthStore.getState().init();

    expect(getOAuthClient).not.toHaveBeenCalled();
    expect(useAuthStore.getState().loading).toBe(false);
  });

  it('loads the client when a DID is persisted', async () => {
    getOAuthClient.mockResolvedValue(clientWithNoSession());
    useAuthStore.setState({ did: 'did:plc:abc123' });

    await useAuthStore.getState().init();

    expect(getOAuthClient).toHaveBeenCalledOnce();
    expect(useAuthStore.getState().loading).toBe(false);
  });

  it('loads the client when only the OAuth session store has a session', async () => {
    // Persisted state can be cleared independently of the client's own storage.
    getOAuthClient.mockResolvedValue(clientWithNoSession());
    hasOAuthSessionToRestore.mockReturnValue(true);

    await useAuthStore.getState().init();

    expect(getOAuthClient).toHaveBeenCalledOnce();
  });

  it('loads the client when the page booted on an OAuth callback', async () => {
    getOAuthClient.mockResolvedValue(clientWithNoSession());
    bootedOnOAuthCallback.mockReturnValue(true);

    await useAuthStore.getState().init();

    expect(getOAuthClient).toHaveBeenCalledOnce();
  });

  it('surfaces an error and stops loading when the client fails to load', async () => {
    // A failed chunk fetch must not leave the UI stuck on a spinner — the
    // /oauth/callback route holds position for as long as loading is true.
    getOAuthClient.mockRejectedValue(new Error('Failed to fetch dynamically imported module'));
    useAuthStore.setState({ did: 'did:plc:abc123' });

    await useAuthStore.getState().init();

    const state = useAuthStore.getState();
    expect(state.loading).toBe(false);
    expect(state.error).toBe('Failed to fetch dynamically imported module');
  });
});

describe('useAuthStore.republishFlow', () => {
  const flow = {
    id: 'f1',
    name: 'Flow',
    active: true,
    dryRun: false,
    createdAt: '2026-11-24T00:00:00.000Z',
    trigger: { type: 'MANUAL' as const, details: {} },
    steps: [{ type: 'action' as const, id: 'a1', action: { type: 'LOG' as const, details: {} } }],
  };

  const agentStub = () => {
    const repo = {
      createRecord: vi.fn().mockResolvedValue({ data: { uri: 'at://did:plc:me/app.flowstate.automation/new1', cid: 'c' } }),
      putRecord: vi.fn().mockResolvedValue({ data: { uri: 'at://did:plc:me/app.flowstate.automation/v2a', cid: 'c' } }),
      deleteRecord: vi.fn().mockResolvedValue({}),
    };
    return { repo, agent: { assertDid: 'did:plc:me', com: { atproto: { repo } } } };
  };

  it('replaces a v1 record: writes the v2 record first, then deletes the old one', async () => {
    const { repo, agent } = agentStub();
    useAuthStore.setState({
      agent: agent as never,
      publishedFlows: { f1: { uri: 'at://did:plc:me/app.flowstate.flow/old1', rkey: 'old1' } },
    });

    await useAuthStore.getState().republishFlow(flow);

    expect(repo.createRecord).toHaveBeenCalledWith(expect.objectContaining({ collection: 'app.flowstate.automation' }));
    expect(repo.deleteRecord).toHaveBeenCalledWith({ repo: 'did:plc:me', collection: 'app.flowstate.flow', rkey: 'old1' });
    expect(repo.createRecord.mock.invocationCallOrder[0]).toBeLessThan(repo.deleteRecord.mock.invocationCallOrder[0]);
    expect(useAuthStore.getState().publishedFlows.f1).toEqual({ uri: 'at://did:plc:me/app.flowstate.automation/new1', rkey: 'new1' });
  });

  it('keeps the v2 record if deleting the old one fails', async () => {
    const { repo, agent } = agentStub();
    repo.deleteRecord.mockRejectedValueOnce(new Error('network'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    useAuthStore.setState({
      agent: agent as never,
      publishedFlows: { f1: { uri: 'at://did:plc:me/app.flowstate.flow/old1', rkey: 'old1' } },
    });

    await useAuthStore.getState().republishFlow(flow);

    expect(useAuthStore.getState().publishedFlows.f1.rkey).toBe('new1');
    warn.mockRestore();
  });

  it('updates a v2 record in place so its URI stays stable', async () => {
    const { repo, agent } = agentStub();
    useAuthStore.setState({
      agent: agent as never,
      publishedFlows: { f1: { uri: 'at://did:plc:me/app.flowstate.automation/v2a', rkey: 'v2a' } },
    });

    await useAuthStore.getState().republishFlow(flow);

    expect(repo.putRecord).toHaveBeenCalledWith(expect.objectContaining({ collection: 'app.flowstate.automation', rkey: 'v2a' }));
    expect(repo.createRecord).not.toHaveBeenCalled();
    expect(repo.deleteRecord).not.toHaveBeenCalled();
  });
});
