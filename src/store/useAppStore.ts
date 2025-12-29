import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { WebhookConfig, Flow, TriggerType, ActionType, LogEntry } from '@/types';
import { executeWebhook, executeNotification } from '@/services/actions';

export type { Flow, TriggerType, ActionType } from '@/types';

// 2. State Interface

interface AppState {
  flows: Flow[];
  logs: LogEntry[];
  webhookSecret: string;
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
  addFlowFromTemplate: (template: Omit<Flow, 'id'>) => void;
  updateFlow: (flow: Flow) => void;
  deleteFlow: (flowId: string) => void;
  addLog: (log: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  processDeepLink: (params: URLSearchParams) => void;
  triggerFlows: (type: TriggerType, details: Record<string, any>, specificFlowId?: string) => void;
  regenerateWebhookSecret: () => void;
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
      webhookSecret: uuidv4(),
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
      addFlowFromTemplate: (template) => {
        const newFlow = { ...template, id: uuidv4() };
        set((state) => ({ flows: [...state.flows, newFlow] }));
        get().addLog({
          flowId: newFlow.id,
          status: 'success',
          message: `Installed flow template: ${newFlow.name}`,
        });
      },
      regenerateWebhookSecret: () => set({ webhookSecret: uuidv4() }),
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
        const { flows, addLog, triggerFlows, webhookSecret } = get();
        const secret = params.get('secret');
        params.delete('secret'); // Don't use secret for matching

        let details = Object.fromEntries(params.entries());

        // Support for JSON payload in query params (for iOS Shortcuts)
        const jsonPayload = params.get('payload');
        if (jsonPayload) {
          try {
            const parsed = JSON.parse(jsonPayload);
            details = { ...details, ...parsed };
            delete details.payload;
          } catch (e) {
            addLog({
              flowId: 'SYSTEM',
              status: 'failure',
              message: `Failed to parse deep link payload: ${jsonPayload}`,
            });
          }
        }

        let foundAnyFlow = false;
        for (const flow of flows) {
          if (!flow.enabled || flow.trigger.type !== 'DEEP_LINK') {
            continue;
          }

          // Trigger Details Match
          const triggerDetails = flow.trigger.details;
          const isMatch = Object.keys(triggerDetails).every(
            (key) => details[key] === triggerDetails[key]
          );

          if (!isMatch) {
            continue;
          }

          foundAnyFlow = true;

          // Security Key Check (Flow specific OR global)
          const requiredSecret = flow.securityKey || webhookSecret;
          if (requiredSecret && requiredSecret !== secret) {
            addLog({
              flowId: flow.id,
              status: 'failure',
              message: `Deep link trigger failed: Invalid security key.`,
            });
            continue;
          }

          triggerFlows('DEEP_LINK', details, flow.id);
        }

        if (!foundAnyFlow) {
          addLog({
            flowId: 'SYSTEM',
            status: 'failure',
            message: `No flow found for deep link: ${params.toString()}`,
          });
        }
      },

      triggerFlows: (type, details, specificFlowId) => {
        const { flows, addLog } = get();

        for (const flow of flows) {
          if (!flow.enabled) continue;
          if (specificFlowId && flow.id !== specificFlowId) continue;
          if (!specificFlowId && flow.trigger.type !== type) continue;

          // Match details if not already matched (for deep links, we might pass specificFlowId)
          if (!specificFlowId) {
            const triggerDetails = flow.trigger.details;
            const isMatch = Object.keys(triggerDetails).every(
              (key) => details[key] === triggerDetails[key]
            );
            if (!isMatch) continue;
          }

          addLog({
            flowId: flow.id,
            status: 'success',
            message: `Flow triggered by ${type}: ${flow.name}.`,
          });

          // Execute actions
          flow.actions.forEach(action => {
            if (action.type === 'WEBHOOK') {
              executeWebhook(action.details as any, details).then(result => {
                if (!result.success) {
                  addLog({
                    flowId: flow.id,
                    status: 'failure',
                    message: `Webhook failed: ${result.message}`,
                  });
                }
              }).catch(err => {
                addLog({
                  flowId: flow.id,
                  status: 'failure',
                  message: `Webhook error: ${err.message}`,
                });
              });
            } else if (action.type === 'NOTIFICATION') {
              executeNotification(action.details as any, details).then(result => {
                if (!result.success) {
                  addLog({
                    flowId: flow.id,
                    status: 'failure',
                    message: `Notification failed: ${result.message}`,
                  });
                }
              }).catch(err => {
                addLog({
                  flowId: flow.id,
                  status: 'failure',
                  message: `Notification error: ${err.message}`,
                });
              });
            }
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
