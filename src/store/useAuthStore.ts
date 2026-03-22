import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Agent } from '@atproto/api';
import { OAuthSession } from '@atproto/oauth-client-browser';
import { getOAuthClient } from '@/lib/atproto';
import { Flow } from '@/types';
import {
  publishFlow as publishFlowToNetwork,
  unpublishFlow as unpublishFlowFromNetwork,
  listPublishedFlows,
  recordInstall,
  discoverFlowsFromFollows,
  PublishedFlow,
} from '@/services/atproto';

interface AuthState {
  /** The user's DID (e.g. did:plc:abc123) — persisted */
  did: string | null;
  /** The user's handle (e.g. bbthorson.bsky.social) — persisted */
  handle: string | null;
  /** Map of local flow ID → published AT URI — persisted */
  publishedFlows: Record<string, { uri: string; rkey: string }>;
  /** Whether auth is currently initializing */
  loading: boolean;
  /** Current error message, if any */
  error: string | null;

  // Non-persisted runtime state
  session: OAuthSession | null;
  agent: Agent | null;
  /** Flows discovered from the user's social graph */
  networkFlows: PublishedFlow[];
  /** Whether network discovery is in progress */
  discovering: boolean;

  // Actions
  init: () => Promise<void>;
  signIn: (handle: string) => Promise<void>;
  signOut: () => Promise<void>;
  publishFlow: (flow: Flow) => Promise<void>;
  unpublishFlow: (flowId: string) => Promise<void>;
  installFromNetwork: (published: PublishedFlow) => Promise<void>;
  discoverFromFollows: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      did: null,
      handle: null,
      publishedFlows: {},
      loading: false,
      error: null,
      session: null,
      agent: null,
      networkFlows: [],
      discovering: false,

      init: async () => {
        set({ loading: true, error: null });
        try {
          const client = getOAuthClient();
          const result = await client.init();

          if (result) {
            const session = result.session;
            const agent = new Agent(session);
            const profile = await agent.getProfile({
              actor: session.did,
            });
            set({
              session,
              agent,
              did: session.did,
              handle: profile.data.handle,
              loading: false,
            });
          } else {
            set({ loading: false });
          }
        } catch (err) {
          console.error('AT Protocol auth init failed:', err);
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Auth initialization failed',
          });
        }
      },

      signIn: async (handle: string) => {
        set({ loading: true, error: null });
        try {
          const client = getOAuthClient();
          await client.signIn(handle, {
            state: crypto.randomUUID(),
          });
        } catch (err) {
          console.error('AT Protocol sign-in failed:', err);
          set({
            loading: false,
            error: err instanceof Error ? err.message : 'Sign-in failed',
          });
        }
      },

      signOut: async () => {
        const { did } = get();
        if (did) {
          try {
            const client = getOAuthClient();
            await client.revoke(did);
          } catch (err) {
            console.error('AT Protocol revoke failed:', err);
          }
        }
        set({
          did: null,
          handle: null,
          publishedFlows: {},
          session: null,
          agent: null,
          networkFlows: [],
          error: null,
        });
      },

      publishFlow: async (flow: Flow) => {
        const { agent } = get();
        if (!agent) throw new Error('Not signed in');

        const { uri } = await publishFlowToNetwork(agent, flow);
        const rkey = uri.split('/').pop()!;
        set((state) => ({
          publishedFlows: {
            ...state.publishedFlows,
            [flow.id]: { uri, rkey },
          },
        }));
      },

      unpublishFlow: async (flowId: string) => {
        const { agent, publishedFlows } = get();
        if (!agent) throw new Error('Not signed in');

        const ref = publishedFlows[flowId];
        if (!ref) return;

        await unpublishFlowFromNetwork(agent, ref.rkey);
        set((state) => {
          const { [flowId]: _, ...rest } = state.publishedFlows;
          return { publishedFlows: rest };
        });
      },

      installFromNetwork: async (published: PublishedFlow) => {
        const { agent } = get();
        // Record the install on the network if signed in
        if (agent) {
          try {
            await recordInstall(agent, published.uri);
          } catch (err) {
            console.error('Failed to record install:', err);
          }
        }
        // The actual local install is handled by useAppStore.addFlowFromTemplate
        // called from the UI — this just records the network side
      },

      discoverFromFollows: async () => {
        const { agent } = get();
        if (!agent) return;

        set({ discovering: true });
        try {
          const flows = await discoverFlowsFromFollows(agent);
          set({ networkFlows: flows, discovering: false });
        } catch (err) {
          console.error('Discovery failed:', err);
          set({ discovering: false });
        }
      },
    }),
    {
      name: 'flow-state-auth',
      partialize: (state) => ({
        did: state.did,
        handle: state.handle,
        publishedFlows: state.publishedFlows,
      }),
    },
  ),
);
