import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Agent } from '@atproto/api';
import type { OAuthSession } from '@atproto/oauth-client-browser';
import {
  getOAuthClient,
  bootedOnOAuthCallback,
  hasOAuthSessionToRestore,
} from '@/lib/atproto';
import { Flow } from '@/types';
import {
  publishFlow as publishFlowToNetwork,
  unpublishFlow as unpublishFlowFromNetwork,
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
  /** Whether the user has explicitly chosen to skip onboarding — persisted */
  onboardingSkipped: boolean;
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
  skipOnboarding: () => void;
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
      onboardingSkipped: false,
      // Start in the loading state when this page load is an OAuth redirect, so
      // the /oauth/callback route holds position until init() has consumed the
      // response instead of racing it (see OAuthCallback in App.tsx).
      loading: bootedOnOAuthCallback(),
      error: null,
      session: null,
      agent: null,
      networkFlows: [],
      discovering: false,

      init: async () => {
        // Decide whether we need the AT Protocol client *before* importing it.
        // Both checks are plain reads of the URL and localStorage, so a user who
        // has never signed in never downloads the ~242 kB (gzip) client.
        const isCallback = bootedOnOAuthCallback();
        const hasSession = Boolean(get().did) || hasOAuthSessionToRestore();
        if (!isCallback && !hasSession) {
          set({ loading: false });
          return;
        }

        set({ loading: true, error: null });
        try {
          const client = await getOAuthClient();
          const result = await client.init();

          if (result) {
            const session = result.session;
            const { Agent } = await import('@atproto/api');
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
          const client = await getOAuthClient();
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

      skipOnboarding: () => {
        set({ onboardingSkipped: true });
      },

      signOut: async () => {
        const { did } = get();
        if (did) {
          try {
            const client = await getOAuthClient();
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
        onboardingSkipped: state.onboardingSkipped,
      }),
    },
  ),
);
