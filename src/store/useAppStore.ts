import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

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
        const { flows, logs } = get();
        get().updateLastBackupTimestamp();
        return JSON.stringify({ flows, logs }, null, 2);
      },

      importVault: (json: string) => {
        try {
          const { flows, logs } = JSON.parse(json);
          if (Array.isArray(flows) && Array.isArray(logs)) {
            set({ flows, logs, lastBackupTimestamp: Date.now() });
            return { success: true, message: 'Vault successfully imported.' };
          }
          return { success: false, message: 'Invalid vault file format.' };
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
    }),
    {
      name: 'flow-state-v2', // New storage name
      // Persist the entire state except for the 'initialized' flag
      partialize: (state) =>
        Object.fromEntries(Object.entries(state).filter(([key]) => key !== 'initialized')) as Omit<
          AppState,
          'initialized'
        >,
      // Set 'initialized' flag once hydration is complete
      onRehydrateStorage: () => () => {
        useAppStore.getState().setInitialized(true);
      },
    }
  )
);