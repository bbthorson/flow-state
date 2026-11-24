import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { Flow, TriggerType, ActionType, LogEntry, TimeBlock, FlowAction } from '@/types';
import { parseActionDetails, parseRecipe, type ActionDetailsFor } from '@/lib/flow-schema';
import { executeWebhook, executeNotification, executeVibration, executeClipboard, executeShare, executeWakeLock, executeSpeech, templateString, type ActionResult } from '@/services/actions';
import { matchesTrigger, runFlow, type RunData, type ScheduledRun } from '@/lib/engine';
import { isV1Flow, migrateFlowV1 } from '@/lib/migrate';
import { useDeviceStore } from '@/store/useDeviceStore';

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
  /**
   * Deferred action steps. Persisted so a delay survives the app closing: a
   * due item runs at the next open unless its `expiresAt` has passed.
   */
  scheduled: (ScheduledRun & { id: string })[];
  webhookSecret: string;
  lastBackupTimestamp: number | null;
  initialized: boolean; // To track if the store has been hydrated from localStorage

  // Legacy webhook data (kept for vault import/export compatibility)
  webhooks: unknown[];
}

/** What actually goes to storage — everything but the hydration flag. */
type PersistedState = Omit<AppState, 'initialized'>;

/** A flow as callers create it; the store assigns `id` and, if absent, `createdAt`. */
export type NewFlow = Omit<Flow, 'id' | 'createdAt'> & { createdAt?: string };

/** Bumped when the persisted shape changes; see `migrate` at the bottom. */
export const STORE_VERSION = 1;

// 3. Actions Interface

interface AppActions {
  addFlow: (flow: NewFlow) => string;
  addFlowFromTemplate: (template: NewFlow) => void;
  updateFlow: (flow: Flow) => void;
  deleteFlow: (flowId: string) => void;
  addBlock: (block: Omit<TimeBlock, 'id'>) => string;
  updateBlock: (block: TimeBlock) => void;
  deleteBlock: (blockId: string) => void;
  addLog: (log: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  processDeepLink: (params: URLSearchParams) => void;
  /** Resolves once every matching flow's run has finished (scheduled steps excluded). */
  triggerFlows: (type: TriggerType, details: Record<string, any>, specificFlowId?: string) => Promise<void>;
  scheduleRun: (item: ScheduledRun) => void;
  cancelScheduled: (identifier: string) => void;
  /** Run deferred steps that are due; drop ones that expired while the app was closed. */
  runDueScheduled: (now?: number) => Promise<void>;
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
  exec: (details: ActionDetailsFor<T>, data: Record<string, any>, trustedRoots: ReadonlySet<string>) => Promise<ActionResult>,
) {
  return {
    label,
    run(details: Record<string, unknown>, data: Record<string, any>, trustedRoots: ReadonlySet<string>) {
      const parsed = parseActionDetails(type, details);
      if (!parsed.ok) return { ok: false as const, reason: parsed.reason };
      return { ok: true as const, result: exec(parsed.details, data, trustedRoots) };
    },
  };
}

/** Action executors, keyed by type. LOG is handled in `runAction`. */
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
 * Run one action. Details are validated (see `@/lib/flow-schema`) rather than
 * asserted: locally stored flows never pass through the network validation, so
 * this is the only check they get. Failures come back as results — the engine
 * logs them — and throws are caught here so none becomes an unhandled rejection.
 */
async function runAction(
  flowId: string,
  action: FlowAction,
  data: RunData,
  trustedRoots: ReadonlySet<string>,
  addLog: AppActions['addLog'],
): Promise<ActionResult> {
  if (action.type === 'LOG') {
    const message = templateString(action.details?.message, data);
    if (message) addLog({ flowId, status: 'success', message });
    return { success: true };
  }
  const executor = ACTION_EXECUTORS[action.type as keyof typeof ACTION_EXECUTORS];
  if (!executor) return { success: false, message: `${action.type} is not supported by this build` };

  const outcome = executor.run(action.details ?? {}, data, trustedRoots);
  if (!outcome.ok) {
    return { success: false, message: `skipped — invalid settings (${outcome.reason})` };
  }
  try {
    return await outcome.result;
  } catch (err: unknown) {
    return { success: false, message: err instanceof Error ? err.message : String(err) };
  }
}

/** The `device.*` values conditions and templates can read. */
export function deviceSnapshot(): RunData {
  const d = useDeviceStore.getState();
  return {
    battery: { level: d.battery.level, charging: d.battery.charging, supported: d.battery.supported },
    network: { online: d.network.online, type: d.network.type, effectiveType: d.network.effectiveType },
    location: { latitude: d.geolocation.latitude, longitude: d.geolocation.longitude, accuracy: d.geolocation.accuracy },
    idle: { userState: d.idle.userState, screenState: d.idle.screenState },
    orientation: { type: d.orientation.type, angle: d.orientation.angle },
    visibility: d.visibility.state,
  };
}

function actionLabel(action: FlowAction): string {
  if (action.type === 'LOG') return 'Log';
  return ACTION_EXECUTORS[action.type as keyof typeof ACTION_EXECUTORS]?.label ?? action.type;
}

const scheduleTimers = new Map<string, ReturnType<typeof setTimeout>>();

// 4. Store Implementation

export const useAppStore = create<AppState & AppActions>()(
  persist(
    (set, get) => ({
      // Initial State
      flows: [],
      blocks: [],
      logs: [],
      scheduled: [],
      webhookSecret: uuidv4(),
      lastBackupTimestamp: null,
      initialized: false,

      webhooks: [],

      // Actions
      setInitialized: (initialized) => set({ initialized }),
      addFlow: (flow) => {
        const id = uuidv4();
        set((state) => ({ flows: [...state.flows, { createdAt: new Date().toISOString(), ...flow, id }] }));
        return id;
      },
      addFlowFromTemplate: (template) => {
        const newFlow: Flow = { createdAt: new Date().toISOString(), ...template, id: uuidv4() };
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
      deleteFlow: (flowId) =>
        set((state) => ({
          flows: state.flows.filter((flow) => flow.id !== flowId),
          scheduled: state.scheduled.filter((item) => item.flowId !== flowId),
        })),
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
            // Vault files from before v2 hold v1 flows; migrate, then validate.
            updates.flows = flows
              .filter((f: unknown) => !!f && typeof f === 'object')
              .map((f: any) => (isV1Flow(f) ? migrateFlowV1(f) : f))
              .filter((f: any) => parseRecipe(f).ok)
              .map((f: any): Flow => ({
                ...f,
                id: typeof f.id === 'string' && f.id ? f.id : uuidv4(),
                active: !!f.active,
                dryRun: !!f.dryRun,
                createdAt: typeof f.createdAt === 'string' ? f.createdAt : new Date().toISOString(),
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
          if (!flow.active || flow.trigger.type !== 'DEEP_LINK') {
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
          const requiredSecret = flow.secrets?.securityKey || webhookSecret;
          if (requiredSecret && requiredSecret !== secret) {
            addLog({
              flowId: flow.id,
              status: 'failure',
              message: `Deep link trigger failed: Invalid security key.`,
            });
            continue;
          }

          void triggerFlows('DEEP_LINK', details, flow.id);
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

      triggerFlows: async (type, details, specificFlowId) => {
        const { flows, addLog } = get();
        const runs: Promise<unknown>[] = [];

        for (const flow of flows) {
          if (!flow.active) continue;
          if (flow.trigger.type !== type) continue;
          if (specificFlowId && flow.id !== specificFlowId) continue;
          if (!specificFlowId && !matchesTrigger(type, flow.trigger.details, details)) continue;

          addLog({
            flowId: flow.id,
            status: 'success',
            message: `${flow.dryRun ? 'Dry run: ' : ''}Flow triggered by ${type}: ${flow.name}.`,
          });

          const log = (status: 'success' | 'failure', message: string) => addLog({ flowId: flow.id, status, message });
          runs.push(
            runFlow(flow, details, { device: deviceSnapshot(), now: new Date() }, {
              execute: (action, data, trusted) => runAction(flow.id, action, data, trusted, addLog),
              log,
              schedule: (item) => get().scheduleRun(item),
              cancelScheduled: (identifier) => get().cancelScheduled(identifier),
              labelFor: actionLabel,
            }).then((outcome) => {
              if (outcome.status === 'gated') log('success', `${flow.name}: stopped by a condition.`);
            }),
          );
        }
        await Promise.all(runs);
      },

      scheduleRun: (item: ScheduledRun) => {
        const id = uuidv4();
        set((state) => ({ scheduled: [...state.scheduled, { ...item, id }] }));
        const wait = Math.max(0, item.dueAt - Date.now());
        // Timers only cover the time the app stays open; `runDueScheduled`
        // picks up anything that comes due while it is closed.
        if (wait < 2 ** 31 - 1) {
          scheduleTimers.set(id, setTimeout(() => void get().runDueScheduled(), wait));
        }
        get().addLog({ flowId: item.flowId, status: 'success', message: `Scheduled ${item.action.type} as "${item.identifier}".` });
      },

      cancelScheduled: (identifier) => {
        const cancelled = get().scheduled.filter((item) => item.identifier === identifier);
        if (!cancelled.length) return;
        for (const item of cancelled) {
          clearTimeout(scheduleTimers.get(item.id));
          scheduleTimers.delete(item.id);
          get().addLog({ flowId: item.flowId, status: 'success', message: `Cancelled scheduled "${identifier}".` });
        }
        set((state) => ({ scheduled: state.scheduled.filter((item) => item.identifier !== identifier) }));
      },

      runDueScheduled: async (now = Date.now()) => {
        const due = get().scheduled.filter((item) => item.dueAt <= now);
        if (!due.length) return;
        const dueIds = new Set(due.map((item) => item.id));
        set((state) => ({ scheduled: state.scheduled.filter((item) => !dueIds.has(item.id)) }));

        const { addLog, flows } = get();
        await Promise.all(
          due.map(async (item) => {
            scheduleTimers.delete(item.id);
            if (item.expiresAt !== undefined && item.expiresAt < now) {
              addLog({ flowId: item.flowId, status: 'failure', message: `Skipped scheduled "${item.identifier}": it expired before the app was open.` });
              return;
            }
            const flow = flows.find((f) => f.id === item.flowId);
            if (!flow?.active) return; // deleted or switched off since
            const result = await runAction(item.flowId, item.action, item.data, new Set(item.trustedRoots), addLog);
            if (!result.success) {
              addLog({ flowId: item.flowId, status: 'failure', message: `${actionLabel(item.action)} failed: ${result.message ?? 'unknown error'}` });
            }
          }),
        );
      },

    }),
    {
      name: 'flow-state-v2', // New storage name
      storage: resilientStorage,
      version: STORE_VERSION,
      // 0 → 1: v1 flows (enabled/actions/parameters) become the v2 step model.
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<PersistedState> & { flows?: unknown[] };
        if (version < 1) {
          state.flows = (state.flows ?? []).map((f) => (isV1Flow(f) ? migrateFlowV1(f) : f)) as Flow[];
          state.scheduled = [];
        }
        return state as PersistedState;
      },
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
