import { useMemo, useState } from 'react';
import type { Capability, Event, Flow, FlowStep, RunTrace } from '@flowstate/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, FlaskConical, Plus, ShieldCheck, Trash2, Zap } from 'lucide-react';

interface TokenOption {
  label: string;
  expr: string;
  trusted: boolean;
}

const BASE_TOKENS: TokenOption[] = [
  { label: 'time.iso', expr: '{{time.iso}}', trusted: true },
  { label: 'time.hour', expr: '{{time.hour}}', trusted: true },
  { label: 'device.battery.level', expr: '{{device.battery.level}}', trusted: true },
  { label: 'device.network.online', expr: '{{device.network.online}}', trusted: true },
  { label: 'event.type', expr: '{{event.type}}', trusted: false },
  { label: 'event.title', expr: '{{event.title}}', trusted: false },
  { label: 'event.payload', expr: '{{event.payload.value}}', trusted: false },
];

/**
 * Visual Pipeline Editor:
 *   WHEN [Event] -> IF [Condition] -> DO [Command]
 *
 * Includes:
 * - Capability-driven Event & Command pickers (works for local + invited app DIDs)
 * - Taint-aware Token Pills (untrusted tokens are hidden for sensitive fields)
 * - Live Dry-Run Inspector powered by pure `@flowstate/core` engine
 */
export function PipelineEditor({
  initialFlow,
  capabilities,
  secretKeys = [],
  onSave,
  onCancel,
  onDelete,
  onDryRun,
}: {
  initialFlow: Flow;
  capabilities: Capability[];
  secretKeys?: string[];
  onSave: (flow: Flow) => void;
  onCancel: () => void;
  onDelete?: () => void;
  onDryRun: (draft: Flow, mockEvent: Event) => RunTrace;
}) {
  const [draft, setDraft] = useState<Flow>(initialFlow);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newInputLabel, setNewInputLabel] = useState('');
  const [mockTrust, setMockTrust] = useState<'trusted' | 'untrusted'>('trusted');
  const [mockPayloadText, setMockPayloadText] = useState('{"level": 0.15, "charging": false, "value": "hello"}');
  const [showDryRun, setShowDryRun] = useState(false);

  const tokenOptions = useMemo<TokenOption[]>(() => {
    const inputTokens: TokenOption[] = draft.inputs.map((f) => ({
      label: `inputs.${f.name}`,
      expr: `{{inputs.${f.name}}}`,
      trusted: true,
    }));
    const secretTokens: TokenOption[] = secretKeys.map((k) => ({
      label: `secrets.${k}`,
      expr: `{{secrets.${k}}}`,
      trusted: true,
    }));
    return [...inputTokens, ...secretTokens, ...BASE_TOKENS];
  }, [draft.inputs, secretKeys]);

  const addPrimitiveInput = () => {
    const label = newInputLabel.trim();
    if (!label) return;
    const name = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
    if (!name || draft.inputs.some((f) => f.name === name)) return;
    setDraft((prev) => ({
      ...prev,
      inputs: [...prev.inputs, { name, label, type: 'string', required: true }],
    }));
    setNewInputLabel('');
  };

  const allEmits = useMemo(
    () =>
      capabilities.flatMap((cap) =>
        cap.emits.map((ev) => ({
          capabilityId: cap.id,
          capabilityName: cap.name,
          ...ev,
        })),
      ),
    [capabilities],
  );

  const allCommands = useMemo(
    () =>
      capabilities.flatMap((cap) =>
        cap.accepts.map((cmd) => ({
          capabilityId: cap.id,
          capabilityName: cap.name,
          ...cmd,
        })),
      ),
    [capabilities],
  );

  const dryRunTrace = useMemo(() => {
    if (!showDryRun) return null;
    let payload: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(mockPayloadText);
      if (parsed && typeof parsed === 'object') payload = parsed as Record<string, unknown>;
    } catch {
      payload = {};
    }
    const mockEvent: Event = {
      id: 'dry-run-event',
      type: draft.trigger.eventType,
      source: mockTrust === 'trusted' ? 'device' : 'space',
      author: mockTrust === 'trusted' ? 'self' : 'did:plc:external',
      trust: mockTrust,
      hops: 0,
      payload,
      createdAt: new Date().toISOString(),
    };
    return onDryRun(draft, mockEvent);
  }, [draft, mockPayloadText, mockTrust, onDryRun, showDryRun]);

  const addCommandStep = () => {
    const firstCmd = allCommands[0];
    const step: FlowStep = {
      kind: 'command',
      id: `step-${Date.now()}`,
      targetCapability: firstCmd?.capabilityId ?? 'local.log',
      action: firstCmd?.action ?? 'write',
      input: {},
      sensitiveFields: firstCmd?.inputs.filter((f) => f.sensitive).map((f) => f.name),
    };
    setDraft((prev) => ({ ...prev, steps: [...prev.steps, step] }));
  };

  const addConditionStep = () => {
    const step: FlowStep = {
      kind: 'condition',
      id: `cond-${Date.now()}`,
      mode: 'all',
      assertions: [{ field: 'event.payload.level', operator: 'lte', value: '0.2' }],
    };
    setDraft((prev) => ({ ...prev, steps: [...prev.steps, step] }));
  };

  const updateStep = (index: number, next: FlowStep) => {
    setDraft((prev) => ({
      ...prev,
      steps: prev.steps.map((s, i) => (i === index ? next : s)),
    }));
  };

  const removeStep = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      steps: prev.steps.filter((_, i) => i !== index),
    }));
  };

  const appendTokenToCommandInput = (stepIndex: number, fieldName: string, expr: string) => {
    const step = draft.steps[stepIndex];
    if (!step || step.kind !== 'command') return;
    const current = typeof step.input[fieldName] === 'string' ? (step.input[fieldName] as string) : '';
    updateStep(stepIndex, {
      ...step,
      input: { ...step.input, [fieldName]: `${current}${expr}` },
    });
  };

  return (
    <div className="space-y-5 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-bold tracking-tight">Pipeline Editor</h2>
        </div>
        <Button
          size="sm"
          variant={showDryRun ? 'default' : 'outline'}
          onClick={() => setShowDryRun((v) => !v)}
        >
          <FlaskConical className="mr-1.5 h-3.5 w-3.5" />
          Dry Run
        </Button>
      </div>

      {/* Identity */}
      <div className="space-y-3 rounded-lg border p-3">
        <div className="space-y-1">
          <Label htmlFor="flow-name" className="text-xs">
            Flow Name
          </Label>
          <Input
            id="flow-name"
            value={draft.name}
            onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Low Battery Notice"
          />
        </div>
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <Switch
              checked={draft.active}
              onCheckedChange={(active) => setDraft((p) => ({ ...p, active }))}
              aria-label="Active"
            />
            <span className="text-xs font-medium">{draft.active ? 'Active' : 'Paused'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Runner:</span>
            <select
              className="rounded border bg-background px-2 py-1 text-xs text-foreground"
              value={draft.executionTarget}
              onChange={(e) =>
                setDraft((p) => ({ ...p, executionTarget: e.target.value as 'device' | 'hub' }))
              }
            >
              <option value="device">Device (Local)</option>
              <option value="hub">Hub DO (Opt-in)</option>
            </select>
          </div>
        </div>
      </div>

      {/* WHEN block */}
      <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
        <div className="flex items-center gap-2">
          <Badge className="text-[10px] uppercase">WHEN</Badge>
          <span className="text-xs font-semibold">Trigger Event</span>
        </div>
        <select
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={draft.trigger.eventType}
          onChange={(e) =>
            setDraft((p) => ({ ...p, trigger: { ...p.trigger, eventType: e.target.value } }))
          }
        >
          <option value="user.manual.invoked">Manual / Pinned Primitive Tap</option>
          <option value="block.entered">Day Block Entered</option>
          <option value="block.exited">Day Block Exited</option>
          {allEmits.map((ev) => (
            <option key={`${ev.capabilityId}:${ev.type}`} value={ev.type}>
              {ev.capabilityName} — {ev.label} ({ev.type})
            </option>
          ))}
        </select>
      </div>

      {/* App Primitive Inputs */}
      <div className="space-y-2 rounded-lg border p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold">App Primitive Inputs (Optional)</span>
          <span className="text-[11px] text-muted-foreground">Prompted when tapped</span>
        </div>
        {draft.inputs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {draft.inputs.map((inp) => (
              <span
                key={inp.name}
                className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2.5 py-0.5 text-xs"
              >
                <span>{inp.label}</span>
                <code className="font-mono text-[10px] text-muted-foreground">({inp.name})</code>
                <button
                  type="button"
                  className="ml-0.5 text-muted-foreground hover:text-foreground"
                  aria-label={`Remove input ${inp.name}`}
                  onClick={() =>
                    setDraft((p) => ({ ...p, inputs: p.inputs.filter((f) => f.name !== inp.name) }))
                  }
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={newInputLabel}
            onChange={(e) => setNewInputLabel(e.target.value)}
            placeholder="Add input field (e.g. Issue Title)"
            className="h-8 text-xs"
          />
          <Button type="button" size="sm" variant="outline" className="h-8" onClick={addPrimitiveInput}>
            Add
          </Button>
        </div>
      </div>

      {/* Pipeline Steps */}
      <div className="space-y-3">
        {draft.steps.map((step, idx) => {
          if (step.kind === 'condition') {
            const firstAssertion = step.assertions[0] ?? {
              field: 'event.payload.level',
              operator: 'lte' as const,
              value: '0.2',
            };
            return (
              <div key={step.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] uppercase">
                      IF
                    </Badge>
                    <span className="text-xs font-semibold">Condition Gate</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => removeStep(idx)}
                    aria-label="Remove step"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    value={firstAssertion.field}
                    onChange={(e) =>
                      updateStep(idx, {
                        ...step,
                        assertions: [{ ...firstAssertion, field: e.target.value }],
                      })
                    }
                    placeholder="field"
                    className="text-xs"
                  />
                  <select
                    className="rounded-md border bg-background px-2 text-xs"
                    value={firstAssertion.operator ?? 'eq'}
                    onChange={(e) =>
                      updateStep(idx, {
                        ...step,
                        assertions: [{ ...firstAssertion, operator: e.target.value as any }],
                      })
                    }
                  >
                    <option value="eq">==</option>
                    <option value="neq">!=</option>
                    <option value="lte">&lt;=</option>
                    <option value="gte">&gt;=</option>
                    <option value="lt">&lt;</option>
                    <option value="gt">&gt;</option>
                    <option value="contains">contains</option>
                    <option value="exists">exists</option>
                  </select>
                  <Input
                    value={firstAssertion.value ?? ''}
                    onChange={(e) =>
                      updateStep(idx, {
                        ...step,
                        assertions: [{ ...firstAssertion, value: e.target.value }],
                      })
                    }
                    placeholder="value"
                    className="text-xs"
                  />
                </div>
              </div>
            );
          }

          if (step.kind === 'command') {
            const selectedKey = `${step.targetCapability}::${step.action}`;
            const schema = allCommands.find(
              (c) => c.capabilityId === step.targetCapability && c.action === step.action,
            );
            const sensitiveSet = new Set(step.sensitiveFields ?? []);

            return (
              <div key={step.id} className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] uppercase">
                      DO
                    </Badge>
                    <span className="text-xs font-semibold">Command</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => removeStep(idx)}
                    aria-label="Remove step"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={selectedKey}
                  onChange={(e) => {
                    const [capId, action] = e.target.value.split('::');
                    const nextSchema = allCommands.find(
                      (c) => c.capabilityId === capId && c.action === action,
                    );
                    updateStep(idx, {
                      ...step,
                      targetCapability: capId!,
                      action: action!,
                      input: {},
                      sensitiveFields: nextSchema?.inputs.filter((f) => f.sensitive).map((f) => f.name),
                    });
                  }}
                >
                  {allCommands.map((cmd) => (
                    <option
                      key={`${cmd.capabilityId}::${cmd.action}`}
                      value={`${cmd.capabilityId}::${cmd.action}`}
                    >
                      {cmd.capabilityName} — {cmd.label}
                    </option>
                  ))}
                </select>

                {/* Schema-driven fields + Taint-Aware Token Pills */}
                <div className="space-y-2.5">
                  {(schema?.inputs ?? []).map((field) => {
                    const isSensitive = Boolean(field.sensitive || sensitiveSet.has(field.name));
                    const allowedTokens = tokenOptions.filter((t) => !isSensitive || t.trusted);
                    const val = typeof step.input[field.name] === 'string' ? (step.input[field.name] as string) : '';

                    return (
                      <div key={field.name} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">{field.label}</Label>
                          {isSensitive && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700">
                              <ShieldCheck className="h-3 w-3" />
                              Trusted tokens only
                            </span>
                          )}
                        </div>
                        <Input
                          value={val}
                          onChange={(e) =>
                            updateStep(idx, {
                              ...step,
                              input: { ...step.input, [field.name]: e.target.value },
                            })
                          }
                          placeholder={field.description ?? field.label}
                          className="text-xs"
                        />
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {allowedTokens.map((tok) => (
                            <button
                              key={tok.expr}
                              type="button"
                              onClick={() => appendTokenToCommandInput(idx, field.name, tok.expr)}
                              className="rounded-full border bg-muted/60 px-2 py-0.5 font-mono text-[10px] hover:bg-muted"
                            >
                              +{tok.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }

          return null;
        })}

        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" className="flex-1" onClick={addConditionStep}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Condition
          </Button>
          <Button type="button" variant="outline" size="sm" className="flex-1" onClick={addCommandStep}>
            <Zap className="mr-1 h-3.5 w-3.5" />
            Add Command
          </Button>
        </div>
      </div>

      {/* Live Dry-Run Inspector */}
      {showDryRun && (
        <div className="space-y-2 rounded-lg border border-sky-500/30 bg-sky-500/5 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">Live Dry-Run Simulator</span>
            <select
              className="rounded border bg-background px-2 py-0.5 text-[11px]"
              value={mockTrust}
              onChange={(e) => setMockTrust(e.target.value as 'trusted' | 'untrusted')}
            >
              <option value="trusted">Trusted event</option>
              <option value="untrusted">Untrusted (external/deep-link)</option>
            </select>
          </div>
          <Input
            value={mockPayloadText}
            onChange={(e) => setMockPayloadText(e.target.value)}
            className="font-mono text-xs"
            aria-label="Mock event payload JSON"
          />
          {dryRunTrace && (
            <div className="space-y-1 pt-1">
              <div className="text-xs font-medium">
                Outcome: <Badge variant="outline">{dryRunTrace.status}</Badge>
              </div>
              {dryRunTrace.steps.map((s, i) => (
                <div
                  key={`${s.stepId}-${i}`}
                  className="flex items-center justify-between rounded bg-background/80 px-2 py-1 text-xs"
                >
                  <span className="truncate">{s.summary}</span>
                  <Badge variant={s.status === 'failed' ? 'destructive' : 'secondary'} className="text-[10px]">
                    {s.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Save & Delete Footer */}
      <div className="space-y-2">
        <Button
          className="w-full"
          disabled={!draft.name.trim()}
          onClick={() => onSave({ ...draft, updatedAt: new Date().toISOString() })}
        >
          Save Flow
        </Button>
        {onDelete && (
          <Button
            type="button"
            variant={confirmDelete ? 'destructive' : 'ghost'}
            className="w-full text-xs"
            onClick={() => {
              if (confirmDelete) {
                onDelete();
              } else {
                setConfirmDelete(true);
              }
            }}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            {confirmDelete ? 'Confirm Delete Flow' : 'Delete Flow'}
          </Button>
        )}
      </div>
    </div>
  );
}
