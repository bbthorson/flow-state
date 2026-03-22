import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Agent } from '@atproto/api';
import { OAuthSession } from '@atproto/oauth-client-browser';
import { getOAuthClient } from '@/lib/atproto';

interface AuthState {
  /** The user's DID (e.g. did:plc:abc123) — persisted */
  did: string | null;
  /** The user's handle (e.g. bbthorson.bsky.social) — persisted */
  handle: string | null;
  /** Whether auth is currently initializing */
  loading: boolean;
  /** Current error message, if any */
  error: string | null;

  // Non-persisted runtime state (set after init/restore)
  /** Active OAuth session — not persisted */
  session: OAuthSession | null;
  /** AT Protocol agent for making API calls — not persisted */
  agent: Agent | null;

  // Actions
  init: () => Promise<void>;
  signIn: (handle: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      did: null,
      handle: null,
      loading: false,
      error: null,
      session: null,
      agent: null,

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
            // No existing session and not a callback — just clear loading
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
          // This redirects to the auth server and never resolves on success
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
          session: null,
          agent: null,
          error: null,
        });
      },
    }),
    {
      name: 'flow-state-auth',
      // Only persist did and handle — session/agent are runtime objects
      partialize: (state) => ({
        did: state.did,
        handle: state.handle,
      }),
    },
  ),
);
