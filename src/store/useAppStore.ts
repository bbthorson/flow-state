import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { WebhookConfig } from '@/types'; // Import WebhookConfig

interface AppState {
  charging: boolean | null;
  setCharging: (charging: boolean | null) => void;
  faceDown: boolean | null;
  setFaceDown: (faceDown: boolean | null) => void;
  activeScreen: 'status' | 'settings';
  setActiveScreen: (screen: 'status' | 'settings') => void;
  lastSentTime: Date | null;
  setLastSentTime: (time: Date | null) => void;
  lastStatus: 'Sent successfully' | 'Failed' | null;
  setLastStatus: (status: 'Sent successfully' | 'Failed' | null) => void;
  webhooks: WebhookConfig[];
  setWebhooks: (webhooks: WebhookConfig[] | ((prev: WebhookConfig[]) => WebhookConfig[])) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      charging: null,
      setCharging: (charging) => set({ charging }),
      faceDown: null,
      setFaceDown: (faceDown) => set({ faceDown }),
      activeScreen: 'status',
      setActiveScreen: (activeScreen) => set({ activeScreen }),
      lastSentTime: null,
      setLastSentTime: (lastSentTime) => set({ lastSentTime }),
      lastStatus: null,
      setLastStatus: (lastStatus) => set({ lastStatus }),
      webhooks: [], // Initialize with an empty array
      setWebhooks: (webhooks) => set(state => ({ webhooks: typeof webhooks === 'function' ? webhooks(state.webhooks) : webhooks })),
    }),
    {
      name: 'flow-state-webhooks', // name of the item in the storage (must be unique)
      partialize: (state) => ({ webhooks: state.webhooks }), // only persist the 'webhooks' state
    }
  )
);
