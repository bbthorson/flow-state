import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { Flow, TriggerType, ActionType, LogEntry, TimeBlock } from '@/types';
import { parseActionDetails, parseFlowRecord, type ActionDetailsFor } from '@/lib/flow-schema';
import { executeWebhook, executeNotification, executeVibration, executeClipboard, executeShare, executeWakeLock, executeSpeech, type ActionResult } from '@/services/actions';

export type { Flow, TriggerType, ActionType, TimeBlock } from '@/types';

/**
 * How many execution log entries to keep.
 *
 * The whole store is serialised to one localStorage string on every write, so an
 * uncapped history makes each flow execution progressively slower and eventually
 * blows the ~5 MB quota — at which point *nothing* persists any more, flows
 * included. Only the most recent handful is ever displayed.
 */
export const MAX_LOGS = 200;

/**
 * localStorage, but a quota failure drops the execution history and retries
 * instead of silently losing the whole write. History is the disposable part of
 * the store; flows and the day plan are not.
 */
export function writePersisted(
  backend: Pick<Storage, 'setItem'>,
  name: string,
  value: string,
): void {
  try {
    backend.setItem(name, value);
  } catch (err) {
    try {
      const parsed = JSON.parse(value);
      if (parsed?.state?.logs?.length) {
        parsed.state.logs = [];
        backend.setItem(name, JSON.stringify(parsed));
        console.warn(
          '[flow-state] Storage quota exceeded — execution history was dropped so flows stay saved.',
        );
        return;
      }
    } catch {
      // Retry failed (or there was no history to drop) — report the original error.
    }
    console.error('[flow-state] Failed to persist state:', err);
  }
}

const resilientStorage = createJSONStorage<PersistedState>(() => ({
  getItem: (name) => localStorage.getItem(name),
  removeItem: (name) => localStorage.removeItem(name),
  setItem: (name, value) => writePersisted(localStorage, name, value),
}));

// 2. State Interface

interface AppState {
  flows: Flow[];
  blocks: TimeBlock[]; // recurring daily plan (Focus/Care/Triage)
  logs: LogEntry[];
  webhookSecret: string;
  lastBackupTimestamp: number | null;
  initialized: boolean; // To track if the store has been hydrated from localStorage

  // Legacy webhook data (kept for vault import/export compatibility)
  webhooks: unknown[];
}

/** What actually goes to storage — everything but the hydration flag. */
type PersistedState = Omit<AppState, 'initialized'>;

// 3. Actions Interface

interface AppActions {
  addFlow: (flow: Omit<Flow, 'id'>) => string;
  addFlowFromTemplate: (template: Omit<Flow, 'id'>) => void;
  updateFlow: (flow: Flow) => void;
  deleteFlow: (flowId: string) => void;
  addBlock: (block: Omit<TimeBlock, 'id'>) => string;
  updateBlock: (block: TimeBlock) => void;
  deleteBlock: (blockId: string) => void;
  addLog: (log: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  processDeepLink: (params: URLSearchParams) => void;
  triggerFlows: (type: TriggerType, details: Record<string, any>, specificFlowId?: string) => void;
  regenerateWebhookSecret: () => void;
  exportVault: () => string;
  importVault: (json: string) => { success: boolean; message: string };
  setInitialized: (initialized: boolean) => void;
  updateLastBackupTimestamp: () => void;

}

/**
 * Binds one action type to its executor.
 *
 * The parse happens *inside* here, where `T` is concrete, so the validated
 * details line up with what the executor expects and no cast is needed. Doing
 * it at the call site instead forces one, because TypeScript can't correlate a
 * union-indexed executor with the schema output for that same key.
 */
function bindExecutor<T extends ActionType>(
  type: T,
  label: string,
  exec: (details: ActionDetailsFor<T>, data: Record<string, any>) => Promise<ActionResult>,
) {
  return {
    label,
    run(details: Record<string, unknown>, data: Record<string, any>) {
      const parsed = parseActionDetails(type, details);
      if (!parsed.ok) return { ok: false as const, reason: parsed.reason };
      return { ok: true as const, result: exec(parsed.details, data) };
    },
  };
}

/**
 * Action executors, keyed by type. LOG has no executor — the "Flow triggered by"
 * entry written alongside already is the log.
 */
const ACTION_EXECUTORS = {
  WEBHOOK: bindExecutor('WEBHOOK', 'Webhook', executeWebhook),
  NOTIFICATION: bindExecutor('NOTIFICATION', 'Notification', executeNotification),
  VIBRATION: bindExecutor('VIBRATION', 'Vibration', executeVibration),
  CLIPBOARD: bindExecutor('CLIPBOARD', 'Clipboard', executeClipboard),
  WEB_SHARE: bindExecutor('WEB_SHARE', 'Share', executeShare),
  WAKE_LOCK: bindExecutor('WAKE_LOCK', 'Wake Lock', executeWakeLock),
  SPEECH: bindExecutor('SPEECH', 'Speech', executeSpeech),
};

/**
 * Run one action and log anything that goes wrong.
 *
 * This replaces an if/else chain that cast every `action.details` to `any`. The
 * executors need concrete shapes and `Record<string, any>` does not provide
 * them, so details are validated (see `@/lib/flow-schema`) rather than asserted
 * — locally stored flows never pass through the network validation, so this is
 * the only check they get.
 *
 * It also makes failure handling uniform: previously only WEBHOOK and
 * NOTIFICATION had a `.catch`, so a throw from any of the other five became an
 * unhandled rejection with nothing written to the log.
 */
function runAction(
  flowId: string,
  action: { type: ActionType; details: Record<string, any> },
  data: Record<string, any>,
  addLog: AppActions['addLog'],
): void {
  const executor = ACTION_EXECUTORS[action.type as keyof typeof ACTION_EXECUTORS];
  if (!executor) return; // LOG, or a type this build doesn't run.

  const outcome = executor.run(action.details ?? {}, data);
  if (!outcome.ok) {
    addLog({
      flowId,
      status: 'failure',
      message: `${executor.label} skipped — invalid settings (${outcome.reason})`,
    });
    return;
  }

  outcome.result
    .then((result) => {
      if (!result.success) {
        addLog({ flowId, status: 'failure', message: `${executor.label} failed: ${result.message}` });
      }
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      addLog({ flowId, status: 'failure', message: `${executor.label} error: ${message}` });
    });
}

// 4. Store Implementation

export const useAppStore = create<AppState & AppActions>()(
  persist(
    (set, get) => ({
      // Initial State
      flows: [],
      blocks: [],
      logs: [],
      webhookSecret: uuidv4(),
      lastBackupTimestamp: null,
      initialized: false,

      webhooks: [],

      // Actions
      setInitialized: (initialized) => set({ initialized }),
      addFlow: (flow) => {
        const id = uuidv4();
        set((state) => ({ flows: [...state.flows, { ...flow, id }] }));
        return id;
      },
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
      addBlock: (block) => {
        const id = uuidv4();
        set((state) => ({ blocks: [...state.blocks, { ...block, id }] }));
        return id;
      },
      updateBlock: (updatedBlock) =>
        set((state) => ({
          blocks: state.blocks.map((block) => (block.id === updatedBlock.id ? updatedBlock : block)),
        })),
      deleteBlock: (blockId) => set((state) => ({ blocks: state.blocks.filter((block) => block.id !== blockId) })),
      addLog: (log) => {
        const newLog: LogEntry = {
          ...log,
          id: uuidv4(),
          timestamp: Date.now(),
        };
        set((state) => ({ logs: [newLog, ...state.logs].slice(0, MAX_LOGS) }));
      },
      updateLastBackupTimestamp: () => set({ lastBackupTimestamp: Date.now() }),

      exportVault: () => {
        const { flows, blocks, logs, webhooks } = get();
        get().updateLastBackupTimestamp();
        // Export webhooks as well for compatibility
        return JSON.stringify({ flows, blocks, logs, webhooks }, null, 2);
      },

      importVault: (json: string) => {
        try {
          const { flows, blocks, logs, webhooks } = JSON.parse(json);
          // Allow partial imports or legacy imports
          const updates: Partial<AppState> = { lastBackupTimestamp: Date.now() };

          if (Array.isArray(flows)) {
            updates.flows = flows
              .filter((f): f is Flow => {
                if (!f || typeof f !== 'object') return false;
                const result = parseFlowRecord(f);
                return result.ok;
              })
              .map((f) => ({
                ...f,
                id: typeof f.id === 'string' && f.id ? f.id : uuidv4(),
              }));
          }
          if (Array.isArray(blocks)) updates.blocks = blocks;
          if (Array.isArray(logs)) updates.logs = logs.slice(0, MAX_LOGS);
          if (Array.isArray(webhooks)) updates.webhooks = webhooks;

          set(updates);
          return { success: true, message: 'Vault successfully imported.' };
        } catch {
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
          } catch {
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

        // Only report a miss for something that was actually trying to trigger a
        // flow. A deep link can never fire without a secret, so a query string
        // without one is just an ordinary URL parameter — `?panel=control` (our
        // own Control drawer link) and tracking params like `?utm_source=...`
        // used to write a failure entry on every app open.
        if (!foundAnyFlow && secret !== null) {
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

          // Execute actions with trigger details and optional local/space flow secrets
          const executionContext = flow.secrets
            ? { ...details, secrets: flow.secrets }
            : details;

          flow.actions.forEach((action) => {
            runAction(flow.id, action, executionContext, addLog);
          });
        }
      },

    }),
    {
      name: 'flow-state-v2', // New storage name
      storage: resilientStorage,
      // Persist the entire state except for the 'initialized' flag and transient device status
      partialize: (state) =>
        Object.fromEntries(Object.entries(state).filter(([key]) =>
          key !== 'initialized'
        )) as PersistedState,
      // Set 'initialized' flag once hydration is complete
      onRehydrateStorage: () => (state) => {
        state?.setInitialized(true);
      },
    }
  )
);
