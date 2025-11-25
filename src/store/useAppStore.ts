import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { WebhookConfig } from '@/types';

// 1. Type Definitions from the specification

export type TriggerType = 'NATIVE_BATTERY' | 'DEEP_LINK' | 'MANUAL';
export type ActionType = 'WEBHOOK' | 'NOTIFICATION' | 'LOG';

export interface Flow {
  id: string;
  name: string;
  enabled: boolean;
  securityKey?: string; // For Deep Links verification
  trigger: {
    type: TriggerType;
    // For DEEP_LINK: { param: "event", value: "left_work" }
    // URL would look like: /?event=left_work
    details: Record<string, any>;
  };
  actions: Array<{
    type: ActionType;
    details: Record<string, any>;
  }>;
}

export interface LogEntry {
  id: string;
  flowId: string; // or 'SYSTEM'
  timestamp: number;
  status: 'success' | 'failure';
  message: string;
}

// 2. State Interface

interface AppState {
  flows: Flow[];
  logs: LogEntry[];
  lastBackupTimestamp: number | null;
  initialized: boolean; // To track if the store has been hydrated from localStorage

  // Legacy/Compatibility state for Webhooks and Device Status
  webhooks: WebhookConfig[];
  isCharging: boolean;
  isFaceDown: boolean;
  isOnline: boolean;
  networkType: string | null;
  visibilityState: DocumentVisibilityState;
}

// 3. Actions Interface

interface AppActions {
  addFlow: (flow: Omit<Flow, 'id'>) => void;
  updateFlow: (flow: Flow) => void;
  deleteFlow: (flowId: string) => void;
  addLog: (log: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  processDeepLink: (params: URLSearchParams) => void;
  exportVault: () => string;
  importVault: (json: string) => { success: boolean; message: string };
  setInitialized: (initialized: boolean) => void;
  updateLastBackupTimestamp: () => void;

  // Legacy/Compatibility actions
  setWebhooks: (webhooks: WebhookConfig[] | ((prev: WebhookConfig[]) => WebhookConfig[])) => void;
  setCharging: (charging: boolean) => void;
  setFaceDown: (faceDown: boolean) => void;
  setOnlineStatus: (isOnline: boolean) => void;
  setNetworkType: (networkType: string | null) => void;
  setVisibilityState: (visibilityState: DocumentVisibilityState) => void;
}

// 4. Store Implementation

export const useAppStore = create<AppState & AppActions>()(
  persist(
    (set, get) => ({
      // Initial State
      flows: [],
      logs: [],
      lastBackupTimestamp: null,
      initialized: false,

      webhooks: [],
      isCharging: false,
      isFaceDown: false,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      networkType: null,
      visibilityState: typeof document !== 'undefined' ? document.visibilityState : 'visible',

      // Actions
      setInitialized: (initialized) => set({ initialized }),
      addFlow: (flow) => set((state) => ({ flows: [...state.flows, { ...flow, id: uuidv4() }] })),
      updateFlow: (updatedFlow) =>
        set((state) => ({
          flows: state.flows.map((flow) => (flow.id === updatedFlow.id ? updatedFlow : flow)),
        })),
      deleteFlow: (flowId) => set((state) => ({ flows: state.flows.filter((flow) => flow.id !== flowId) })),
      addLog: (log) => {
        const newLog: LogEntry = {
          ...log,
          id: uuidv4(),
          timestamp: Date.now(),
        };
        set((state) => ({ logs: [newLog, ...state.logs] }));
      },
      updateLastBackupTimestamp: () => set({ lastBackupTimestamp: Date.now() }),

      exportVault: () => {
        const { flows, logs, webhooks } = get();
        get().updateLastBackupTimestamp();
        // Export webhooks as well for compatibility
        return JSON.stringify({ flows, logs, webhooks }, null, 2);
      },

      importVault: (json: string) => {
        try {
          const { flows, logs, webhooks } = JSON.parse(json);
          // Allow partial imports or legacy imports
          const updates: Partial<AppState> = { lastBackupTimestamp: Date.now() };

          if (Array.isArray(flows)) updates.flows = flows;
          if (Array.isArray(logs)) updates.logs = logs;
          if (Array.isArray(webhooks)) updates.webhooks = webhooks;

          set(updates);
          return { success: true, message: 'Vault successfully imported.' };
        } catch (error) {
          return { success: false, message: 'Failed to parse vault file.' };
        }
      },

      processDeepLink: (params) => {
        const { flows, addLog } = get();
        const secret = params.get('secret');
        params.delete('secret'); // Don't use secret for matching

        let processed = false;
        for (const flow of flows) {
          if (!flow.enabled || flow.trigger.type !== 'DEEP_LINK') {
            continue;
          }

          // 1. Security Key Check
          if (flow.securityKey && flow.securityKey !== secret) {
            addLog({
              flowId: flow.id,
              status: 'failure',
              message: `Deep link trigger failed: Invalid security key.`,
            });
            continue; // Invalid secret, skip this flow
          }
          
          // 2. Trigger Details Match
          const triggerDetails = flow.trigger.details;
          const isMatch = Object.keys(triggerDetails).every(
            (key) => params.has(key) && params.get(key) === triggerDetails[key]
          );

          if (isMatch) {
            processed = true;
            addLog({
              flowId: flow.id,
              status: 'success',
              message: `Flow triggered by deep link: ${flow.name}.`,
            });
            
            // TODO: Execute actions associated with the flow
            flow.actions.forEach(action => {
              console.log(`Executing action: ${action.type}`, action.details);
              // In the future, this would call services, e.g., services.webhook.send(...)
            });
          }
        }
        if (!processed) {
            addLog({
                flowId: 'SYSTEM',
                status: 'failure',
                message: `No flow found for deep link: ${params.toString()}`,
              });
        }
      },

      setWebhooks: (webhooksOrFn) => set((state) => ({
          webhooks: typeof webhooksOrFn === 'function' ? webhooksOrFn(state.webhooks) : webhooksOrFn
      })),
      setCharging: (charging) => set({ isCharging: charging }),
      setFaceDown: (faceDown) => set({ isFaceDown: faceDown }),
      setOnlineStatus: (isOnline) => set({ isOnline }),
      setNetworkType: (networkType) => set({ networkType }),
      setVisibilityState: (visibilityState) => set({ visibilityState }),
    }),
    {
      name: 'flow-state-v2', // New storage name
      // Persist the entire state except for the 'initialized' flag and transient device status
      partialize: (state) =>
        Object.fromEntries(Object.entries(state).filter(([key]) =>
            key !== 'initialized' &&
            key !== 'isCharging' &&
            key !== 'isFaceDown' &&
            key !== 'isOnline' &&
            key !== 'networkType' &&
            key !== 'visibilityState'
        )) as Omit<
          AppState,
          'initialized' | 'isCharging' | 'isFaceDown' | 'isOnline' | 'networkType' | 'visibilityState'
        >,
      // Set 'initialized' flag once hydration is complete
      onRehydrateStorage: () => (state) => {
        state?.setInitialized(true);
      },
    }
  )
);
