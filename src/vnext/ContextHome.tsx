import { useMemo, useState } from 'react';
import {
  parseFlow,
  sanitizeFlowForExport,
  type Block,
  type Context,
  type Flow,
  type RunTrace,
} from '@flowstate/core';
import { probePlatformCapabilities, resolveAppCapability } from '@flowstate/adapters';
import { useRuntime } from './runtime';
import { PipelineEditor } from './PipelineEditor';
import { TraceViewer } from './TraceViewer';
import { createStarterFlows } from './starters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  CheckCircle2,
  Clock,
  Download,
  KeyRound,
  Layers,
  Pin,
  Play,
  Plus,
  Radio,
  Settings,
  Share2,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  Users,
  XCircle,
  Zap,
} from 'lucide-react';

const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;

function formatMins(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Layer 4: Context-First PWA Shell (Launcher-Ready)
 *
 * Thin reactive view over headless `RuntimeHost`.
 * Zero sensor hooks, zero localStorage writes, zero dead placeholder tiles.
 */
export function ContextHome() {
  const { host, state } = useRuntime();
  const [editingFlow, setEditingFlow] = useState<Flow | null>(null);
  const [selectedTrace, setSelectedTrace] = useState<RunTrace | null>(null);
  const [primitiveFlow, setPrimitiveFlow] = useState<Flow | null>(null);
  const [primitiveInputs, setPrimitiveInputs] = useState<Record<string, string>>({});
  const [newContextName, setNewContextName] = useState('');
  const [inviteDid, setInviteDid] = useState('');
  const [inviteLabel, setInviteLabel] = useState('');
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [secretName, setSecretName] = useState('');
  const [secretValue, setSecretValue] = useState('');
  const [hubStatus, setHubStatus] = useState<string | null>(null);
  const [recipeJson, setRecipeJson] = useState('');
  const [recipeStatus, setRecipeStatus] = useState<string | null>(null);
  const [vaultMessage, setVaultMessage] = useState<string | null>(null);
  const [newBlockTitle, setNewBlockTitle] = useState('');
  const [newBlockStart, setNewBlockStart] = useState('09:00');
  const [newBlockEnd, setNewBlockEnd] = useState('11:00');

  const platformReport = useMemo(() => probePlatformCapabilities(), []);

  if (!state.initialized) {
    return (
      <div className="flex h-dvh items-center justify-center text-sm text-muted-foreground">
        Starting Flow State runtime…
      </div>
    );
  }

  const activeContext: Context =
    state.contexts.find((c) => c.id === state.activeContextId) ?? state.contexts[0]!;
  const activeBlock = state.blocks.find((b) => b.id === state.activeBlockId) ?? null;

  const contextFlows = state.flows.filter((f) => f.contextId === activeContext.id);
  const pinnedFlows = contextFlows.filter((f) => activeContext.pinnedFlowIds.includes(f.id));
  const contextEvents = state.events
    .filter((e) => !e.space || e.space === activeContext.id)
    .slice(0, 8);
  const recentRuns = state.runs.slice(0, 8);

  const backupStale =
    state.flows.length > 0 &&
    (state.lastBackupTimestamp === null || Date.now() - state.lastBackupTimestamp > SIX_DAYS_MS);

  if (editingFlow) {
    return (
      <div className="mx-auto max-w-lg px-4 py-4">
        <PipelineEditor
          initialFlow={editingFlow}
          capabilities={state.capabilities}
          secretKeys={state.secretKeys}
          onSave={async (updated) => {
            await host.saveFlow(updated);
            setEditingFlow(null);
          }}
          onCancel={() => setEditingFlow(null)}
          onDryRun={(draft, mockEvent) => host.dryRunFlow(draft, mockEvent)}
        />
      </div>
    );
  }

  const handleCreateFlow = () => {
    const newFlow: Flow = {
      id: `flow-${Date.now()}`,
      contextId: activeContext.id,
      name: 'New Flow',
      trigger: { eventType: 'user.manual.invoked' },
      inputs: [],
      steps: [],
      active: true,
      dryRun: false,
      executionTarget: 'device',
      createdAt: new Date().toISOString(),
    };
    setEditingFlow(newFlow);
  };

  const handleInstallStarters = async () => {
    const { flows, pinIds } = createStarterFlows(activeContext.id);
    for (const f of flows) {
      await host.saveFlow(f);
    }
    for (const id of pinIds) {
      await host.togglePinnedFlow(activeContext.id, id);
    }
  };

  const handleRunPrimitive = async (flow: Flow) => {
    if (flow.inputs.length > 0) {
      setPrimitiveInputs({});
      setPrimitiveFlow(flow);
      return;
    }
    const trace = await host.runFlowManual(flow.id, {});
    if (trace) setSelectedTrace(trace);
  };

  const handleCreateContext = async () => {
    const name = newContextName.trim();
    if (!name) return;
    const id = `ctx-${Date.now()}`;
    await host.saveContext({
      id,
      name,
      kind: 'context',
      participants: [],
      pinnedFlowIds: [],
      createdAt: new Date().toISOString(),
    });
    host.setActiveContext(id);
    setNewContextName('');
  };

  const handleInviteApp = async () => {
    const raw = inviteDid.trim();
    if (!raw) return;
    setInviteStatus('Resolving AT Protocol identity & capability manifest…');
    try {
      const resolved = await resolveAppCapability(raw, inviteLabel);
      await host.inviteParticipant(
        activeContext.id,
        {
          did: resolved.did,
          handle: resolved.handle,
          kind: resolved.capability.kind === 'bridge' ? 'bridge' : 'app',
          label: inviteLabel.trim() || resolved.capability.name,
          role: 'writer',
          addedAt: new Date().toISOString(),
        },
        resolved.capability,
      );
      setInviteStatus(
        resolved.fromNetwork
          ? `Invited ${resolved.capability.name} (loaded published capability manifest).`
          : `Invited ${resolved.capability.name} (default capability stub).`,
      );
      setInviteDid('');
      setInviteLabel('');
    } catch (err) {
      setInviteStatus(err instanceof Error ? err.message : 'Could not resolve DID/handle');
    }
  };

  const handleAddSecret = async () => {
    const name = secretName.trim().replace(/[^a-zA-Z0-9_]/g, '');
    if (!name || !secretValue) return;
    await host.setSecret(name, secretValue);
    setSecretName('');
    setSecretValue('');
  };

  const handleCheckHub = async () => {
    setHubStatus('Checking /hub/health…');
    try {
      const res = await fetch('/hub/health');
      if (res.ok) {
        setHubStatus('Hub Worker reachable (/hub/health OK).');
      } else {
        setHubStatus(`Hub responded ${res.status}.`);
      }
    } catch {
      setHubStatus('Running in local-only mode (no Hub Worker reachable).');
    }
  };

  const handleCopyRecipe = async (flow: Flow) => {
    const sanitized = sanitizeFlowForExport(flow);
    const json = JSON.stringify(sanitized, null, 2);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(json);
    }
    setRecipeStatus(`Copied sanitized recipe for "${flow.name}" (Tier-0 secrets stripped).`);
  };

  const handleForkRecipe = async () => {
    const raw = recipeJson.trim();
    if (!raw) return;
    try {
      const parsedJson = JSON.parse(raw) as Record<string, unknown>;
      const checked = parseFlow({
        ...parsedJson,
        id: `fork-${Date.now()}`,
        contextId: activeContext.id,
        active: false,
        dryRun: false,
        createdAt: new Date().toISOString(),
      });
      if (!checked.ok) {
        setRecipeStatus(`Invalid recipe: ${checked.error}`);
        return;
      }
      await host.saveFlow(checked.data);
      setRecipeJson('');
      setRecipeStatus(`Forked "${checked.data.name}" into ${activeContext.name} (paused for review).`);
    } catch {
      setRecipeStatus('Invalid JSON recipe.');
    }
  };

  const handleAddBlock = async () => {
    const title = newBlockTitle.trim();
    if (!title) return;
    const [sh, sm] = newBlockStart.split(':').map(Number);
    const [eh, em] = newBlockEnd.split(':').map(Number);
    const startMin = (sh || 0) * 60 + (sm || 0);
    const endMin = (eh || 0) * 60 + (em || 0);
    if (endMin <= startMin) return;
    const block: Block = {
      id: `blk-${Date.now()}`,
      title,
      kind: 'focus',
      startMin,
      endMin,
      contextId: activeContext.id,
    };
    await host.saveBlock(block);
    setNewBlockTitle('');
  };

  const handleExportVault = async () => {
    const json = await host.exportVault();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flow-state-vault-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setVaultMessage('Vault exported (Tier-0 secrets excluded).');
  };

  const handleImportVault = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const res = await host.importVault(text);
    setVaultMessage(res.message);
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col bg-background text-foreground">
      {/* Stable Context Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="h-4 w-4 text-primary shrink-0" />
          <select
            aria-label="Active Context"
            className="truncate bg-transparent text-sm font-semibold tracking-tight focus:outline-none"
            value={activeContext.id}
            onChange={(e) => host.setActiveContext(e.target.value)}
          >
            {state.contexts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.kind === 'personal' ? '(Personal)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Settings / Capability Matrix / Vault Drawer */}
        <Sheet>
          <SheetTrigger asChild>
            <button
              className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
              aria-label="Settings & Capabilities"
            >
              <Settings className="h-4 w-4" />
              {backupStale && (
                <span
                  className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500"
                  title="Vault backup overdue"
                />
              )}
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[90vw] max-w-md overflow-y-auto space-y-6">
            <SheetHeader>
              <SheetTitle>Controls &amp; Spaces</SheetTitle>
            </SheetHeader>

            {/* Create Context Space */}
            <section className="space-y-2 border-t pt-4">
              <h3 className="text-sm font-semibold">New Focus Context Space</h3>
              <p className="text-xs text-muted-foreground">
                Create an isolated Context to group flows and invited app DIDs.
              </p>
              <div className="flex gap-2">
                <Input
                  value={newContextName}
                  onChange={(e) => setNewContextName(e.target.value)}
                  placeholder="e.g. Work Triage, Household"
                  className="text-xs"
                />
                <Button size="sm" onClick={() => void handleCreateContext()}>
                  Create
                </Button>
              </div>
            </section>

            {/* Invite App DID to Current Context */}
            {activeContext.kind !== 'personal' && (
              <section className="space-y-2 border-t pt-4">
                <h3 className="text-sm font-semibold">Invite App / Bridge DID to {activeContext.name}</h3>
                <p className="text-xs text-muted-foreground">
                  Personal Spaces stay strictly private. Invite apps into Context Spaces instead.
                </p>
                <Input
                  value={inviteDid}
                  onChange={(e) => setInviteDid(e.target.value)}
                  placeholder="did:plc:linear-bridge"
                  className="font-mono text-xs"
                />
                <div className="flex gap-2">
                  <Input
                    value={inviteLabel}
                    onChange={(e) => setInviteLabel(e.target.value)}
                    placeholder="Display name (e.g. Linear)"
                    className="text-xs"
                  />
                  <Button size="sm" onClick={() => void handleInviteApp()}>
                    Invite
                  </Button>
                </div>
                {inviteStatus && <p className="text-xs text-muted-foreground">{inviteStatus}</p>}
              </section>
            )}

            {/* Tier-0 Local Secrets Vault */}
            <section className="space-y-2 border-t pt-4">
              <div className="flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Tier-0 Secrets (Device Only)</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                Referenced as <code className="font-mono">{'{{secrets.name}}'}</code> in Webhook URLs/headers.
                Never exported or synced.
              </p>
              {state.secretKeys.length > 0 && (
                <div className="divide-y rounded-md border">
                  {state.secretKeys.map((k) => (
                    <div key={k} className="flex items-center justify-between px-2.5 py-1.5 text-xs">
                      <code className="font-mono">{k}</code>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        aria-label={`Delete secret ${k}`}
                        onClick={() => void host.deleteSecret(k)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-1.5">
                <Input
                  value={secretName}
                  onChange={(e) => setSecretName(e.target.value)}
                  placeholder="Key (e.g. haToken)"
                  className="h-8 font-mono text-xs"
                />
                <Input
                  type="password"
                  value={secretValue}
                  onChange={(e) => setSecretValue(e.target.value)}
                  placeholder="Secret value"
                  className="h-8 text-xs"
                />
                <Button size="sm" variant="outline" className="h-8" onClick={() => void handleAddSecret()}>
                  Save
                </Button>
              </div>
            </section>

            {/* Optional Cloudflare Hub */}
            <section className="space-y-2 border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Radio className="h-3.5 w-3.5 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">Cloudflare Hub (Optional)</h3>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => void handleCheckHub()}>
                  Check
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Enables revocable HTTPS inboxes (<code className="font-mono">POST /hub/e/:token</code>), Web Push
                wakeups, and opt-in Hub execution.
              </p>
              {hubStatus && <p className="text-xs text-muted-foreground">{hubStatus}</p>}
            </section>

            {/* Fork / Import Recipe */}
            <section className="space-y-2 border-t pt-4">
              <h3 className="text-sm font-semibold">Fork a Shared Recipe</h3>
              <p className="text-xs text-muted-foreground">
                Paste a sanitized Flow State recipe JSON. Validated via Zod and installed paused so you can inspect it first.
              </p>
              <div className="flex gap-1.5">
                <Input
                  value={recipeJson}
                  onChange={(e) => setRecipeJson(e.target.value)}
                  placeholder='{"name":"...","trigger":{...}}'
                  className="h-8 font-mono text-xs"
                />
                <Button size="sm" variant="outline" className="h-8" onClick={() => void handleForkRecipe()}>
                  Fork
                </Button>
              </div>
              {recipeStatus && <p className="text-xs text-muted-foreground">{recipeStatus}</p>}
            </section>

            {/* Capability Matrix */}
            <section className="space-y-2 border-t pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Device Capability Matrix</h3>
                <Badge variant="outline" className="text-[10px] uppercase">
                  {platformReport.platform}
                </Badge>
              </div>
              <div className="divide-y rounded-md border">
                {platformReport.capabilities.map((cap) => (
                  <div key={cap.id} className="flex items-start justify-between gap-2 p-2.5 text-xs">
                    <div>
                      <p className="font-medium">{cap.label}</p>
                      {cap.note && <p className="text-[11px] text-muted-foreground">{cap.note}</p>}
                    </div>
                    <Badge variant={cap.supported ? 'secondary' : 'outline'} className="text-[10px]">
                      {cap.supported ? 'Native' : 'Bridge'}
                    </Badge>
                  </div>
                ))}
              </div>
            </section>

            {/* Vault Backup */}
            <section className="space-y-2 border-t pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Vault Backup (IndexedDB)</h3>
                {backupStale && (
                  <Badge variant="destructive" className="text-[10px]">
                    Backup overdue
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Export Contexts, Flows, and Day Blocks as JSON. Tier-0 secrets never leave this device.
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => void handleExportVault()}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Export
                </Button>
                <label className="flex-1">
                  <input
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={(e) => void handleImportVault(e.target.files?.[0])}
                  />
                  <span className="inline-flex h-9 w-full cursor-pointer items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent">
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    Import
                  </span>
                </label>
              </div>
              {vaultMessage && <p className="text-xs text-muted-foreground">{vaultMessage}</p>}
            </section>
          </SheetContent>
        </Sheet>
      </header>

      <main className="flex-1 space-y-6 px-4 py-5 pb-20">
        {/* Active Context Banner */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{activeContext.name}</h1>
              <p className="text-xs text-muted-foreground">
                {activeBlock
                  ? `Active block: ${activeBlock.title} (${formatMins(activeBlock.startMin)}–${formatMins(activeBlock.endMin)})`
                  : activeContext.description ?? 'Focused Space for deterministic app primitives.'}
              </p>
            </div>
            <Button size="sm" onClick={handleCreateFlow}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Flow
            </Button>
          </div>

          {activeContext.participants.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              {activeContext.participants.map((p) => (
                <Badge key={p.did} variant="secondary" className="text-[10px]">
                  {p.label ?? p.did}
                </Badge>
              ))}
            </div>
          )}
        </section>

        {/* Pinned App Primitives */}
        {pinnedFlows.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pinned App Primitives
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {pinnedFlows.map((flow) => (
                <button
                  key={flow.id}
                  onClick={() => void handleRunPrimitive(flow)}
                  className="flex flex-col items-start gap-1 rounded-lg border bg-card p-3 text-left transition hover:border-primary/50"
                >
                  <div className="flex w-full items-center justify-between">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <Play className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <span className="text-sm font-medium line-clamp-1">{flow.name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {flow.steps.length} step{flow.steps.length === 1 ? '' : 's'}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Flows in this Context */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Context Flows ({contextFlows.length})
            </h2>
          </div>
          {contextFlows.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center space-y-2">
              <Zap className="mx-auto h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-medium">No flows in {activeContext.name}</p>
              <p className="text-xs text-muted-foreground">
                Create a deterministic flow or install starter primitives to try Flow State immediately.
              </p>
              <Button size="sm" variant="outline" onClick={() => void handleInstallStarters()}>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Install Starter Primitives
              </Button>
            </div>
          ) : (
            <div className="divide-y rounded-lg border">
              {contextFlows.map((flow) => {
                const isPinned = activeContext.pinnedFlowIds.includes(flow.id);
                return (
                  <div key={flow.id} className="flex items-center gap-3 p-3">
                    <Switch
                      checked={flow.active}
                      onCheckedChange={(active) => void host.saveFlow({ ...flow, active })}
                      aria-label={`Toggle ${flow.name}`}
                    />
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setEditingFlow(flow)}
                    >
                      <p className="truncate text-sm font-medium">{flow.name}</p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {flow.trigger.eventType} · {flow.steps.length} step{flow.steps.length === 1 ? '' : 's'}
                      </p>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => void handleCopyRecipe(flow)}
                      aria-label={`Share recipe for ${flow.name}`}
                    >
                      <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => void host.togglePinnedFlow(activeContext.id, flow.id)}
                      aria-label={isPinned ? 'Unpin flow' : 'Pin flow'}
                    >
                      <Pin className={`h-3.5 w-3.5 ${isPinned ? 'text-primary fill-primary' : 'text-muted-foreground'}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => void handleRunPrimitive(flow)}
                      aria-label={`Run ${flow.name}`}
                    >
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Brand-Stripped Context Stream */}
        {contextEvents.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Context Stream
            </h2>
            <div className="divide-y rounded-lg border">
              {contextEvents.map((ev) => (
                <div key={ev.id} className="space-y-0.5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{ev.title ?? ev.type}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {ev.source}
                    </Badge>
                  </div>
                  {ev.body && <p className="text-xs text-muted-foreground">{ev.body}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Today's Day Plan (Blocks linked to Contexts) */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Today&apos;s Day Plan
            </h2>
          </div>
          <div className="space-y-2 rounded-lg border p-3">
            {state.blocks.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Add a Focus/Care/Triage block to automatically activate this Context on schedule.
              </p>
            ) : (
              <div className="divide-y">
                {[...state.blocks]
                  .sort((a, b) => a.startMin - b.startMin)
                  .map((b) => (
                    <div key={b.id} className="flex items-center justify-between py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">{b.title}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {b.kind}
                        </Badge>
                      </div>
                      <span className="font-mono text-muted-foreground">
                        {formatMins(b.startMin)}–{formatMins(b.endMin)}
                      </span>
                    </div>
                  ))}
              </div>
            )}
            <div className="flex gap-1.5 pt-2">
              <Input
                value={newBlockTitle}
                onChange={(e) => setNewBlockTitle(e.target.value)}
                placeholder="New block title"
                className="h-8 text-xs"
              />
              <Input
                type="time"
                value={newBlockStart}
                onChange={(e) => setNewBlockStart(e.target.value)}
                className="h-8 w-24 text-xs"
              />
              <Input
                type="time"
                value={newBlockEnd}
                onChange={(e) => setNewBlockEnd(e.target.value)}
                className="h-8 w-24 text-xs"
              />
              <Button size="sm" variant="outline" className="h-8" onClick={() => void handleAddBlock()}>
                Add
              </Button>
            </div>
          </div>
        </section>

        {/* Structured Run Traces ("No Magic") */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Recent Run Traces
          </h2>
          {recentRuns.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Tap any flow or trigger an event to inspect its step-by-step execution trace.
            </p>
          ) : (
            <div className="divide-y rounded-lg border">
              {recentRuns.map((run) => (
                <button
                  key={run.id}
                  onClick={() => setSelectedTrace(run)}
                  className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/40"
                >
                  {run.status === 'completed' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  ) : run.status === 'failed' ? (
                    <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                  ) : (
                    <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{run.flowName}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {run.triggerEvent.type} · {run.steps.length} step{run.steps.length === 1 ? '' : 's'} · {run.status}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Schema-Driven App Primitive Form Sheet */}
      <Sheet open={Boolean(primitiveFlow)} onOpenChange={(open) => !open && setPrimitiveFlow(null)}>
        <SheetContent side="bottom" className="space-y-4">
          {primitiveFlow && (
            <>
              <SheetHeader>
                <SheetTitle>{primitiveFlow.name}</SheetTitle>
              </SheetHeader>
              <div className="space-y-3">
                {primitiveFlow.inputs.map((field) => (
                  <div key={field.name} className="space-y-1">
                    <Label className="text-xs">{field.label}</Label>
                    <Input
                      value={primitiveInputs[field.name] ?? ''}
                      onChange={(e) =>
                        setPrimitiveInputs((prev) => ({ ...prev, [field.name]: e.target.value }))
                      }
                      placeholder={field.description ?? field.label}
                    />
                  </div>
                ))}
                <Button
                  className="w-full"
                  onClick={async () => {
                    const target = primitiveFlow;
                    setPrimitiveFlow(null);
                    const trace = await host.runFlowManual(target.id, primitiveInputs);
                    if (trace) setSelectedTrace(trace);
                  }}
                >
                  Run Primitive
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Run Trace Waterfall Viewer */}
      <TraceViewer
        trace={selectedTrace}
        open={Boolean(selectedTrace)}
        onOpenChange={(open) => !open && setSelectedTrace(null)}
      />
    </div>
  );
}
