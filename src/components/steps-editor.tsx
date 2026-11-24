import type { ReactNode } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { ArrowDown, ArrowUp, Clock, Filter, Lock, PlusCircle, Trash2, Variable, XCircle, ChevronRight, GitBranch } from 'lucide-react';
import type { AssertionOperator, FlowStep, RelativeDelay, TriggerType } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ACTION_LABELS, ACTION_TYPES } from '@/lib/flow-constants';
import { MAX_DEPTH, MAX_STEPS, newStepId, walkSteps } from '@/lib/steps';
import { TRIGGER_DATA_KEYS } from '@/lib/flow-constants';
import type { FlowFormValues } from '@/components/flow-form';

// The steps array is loosely typed in the form (see flow-form.tsx), so field
// paths here are plain strings.
type AnyForm = UseFormReturn<any>;

const OPERATORS: Array<{ value: AssertionOperator; label: string }> = [
  { value: 'eq', label: '=' },
  { value: 'neq', label: '≠' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '≥' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' },
  { value: 'contains', label: 'contains' },
  { value: 'notContains', label: 'not contains' },
  { value: 'startsWith', label: 'starts with' },
  { value: 'endsWith', label: 'ends with' },
  { value: 'exists', label: 'is set' },
  { value: 'notExists', label: 'is not set' },
];

const UNITS: Array<{ value: RelativeDelay['unit']; label: string }> = [
  { value: 's', label: 'seconds' },
  { value: 'm', label: 'minutes' },
  { value: 'h', label: 'hours' },
  { value: 'd', label: 'days' },
];

const DEVICE_FIELDS = [
  'device.battery.level',
  'device.battery.charging',
  'device.network.online',
  'device.network.effectiveType',
  'device.idle.userState',
  'device.orientation.type',
  'device.visibility',
  'time.hour',
  'time.minute',
  'time.weekday',
];

const STEP_LABELS: Record<FlowStep['type'], string> = {
  action: 'Action',
  condition: 'Only if',
  variable: 'Variable',
  cancelScheduled: 'Cancel scheduled',
};

function SmallSelect({
  value,
  onChange,
  options,
  className,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className} aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ConditionEditor({ form, path, listId, branch }: { form: AnyForm; path: string; listId: string; branch: boolean }) {
  const assertions: any[] = form.watch(`${path}.assertions`) ?? [];
  const match: string = form.watch(`${path}.match`) ?? 'all';
  const set = (next: any[]) => form.setValue(`${path}.assertions`, next, { shouldDirty: true });

  return (
    <div className="space-y-2">
      {assertions.length > 1 && (
        <SmallSelect
          label="Match"
          value={match}
          onChange={(v) => form.setValue(`${path}.match`, v, { shouldDirty: true })}
          options={[
            { value: 'all', label: 'All of these' },
            { value: 'any', label: 'Any of these' },
          ]}
          className="h-8 text-xs"
        />
      )}
      {assertions.map((a, i) => {
        const op: AssertionOperator = a.operator ?? 'eq';
        const needsValue = op !== 'exists' && op !== 'notExists';
        return (
          <div key={i} className="space-y-1">
            <Input
              className="h-8 font-mono text-xs"
              placeholder="device.battery.level"
              list={listId}
              value={a.field ?? ''}
              onChange={(e) => set(assertions.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)))}
              aria-label={`Condition ${i + 1} field`}
            />
            <div className="flex items-center gap-1">
              <SmallSelect
                label={`Condition ${i + 1} operator`}
                value={op}
                onChange={(v) => set(assertions.map((x, j) => (j === i ? { ...x, operator: v } : x)))}
                options={OPERATORS}
                className="h-8 w-32 text-xs"
              />
              {needsValue && (
                <Input
                  className="h-8 flex-1 text-xs"
                  placeholder="value"
                  value={a.value ?? ''}
                  onChange={(e) => set(assertions.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                  aria-label={`Condition ${i + 1} value`}
                />
              )}
              {!needsValue && <div className="flex-1" />}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-destructive"
                onClick={() => set(assertions.filter((_, j) => j !== i))}
                disabled={assertions.length === 1}
                aria-label={`Remove condition ${i + 1}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        );
      })}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 text-xs"
        onClick={() => set([...assertions, { field: '', operator: 'eq', value: '' }])}
        disabled={assertions.length >= 10}
      >
        <PlusCircle className="mr-1 h-3 w-3" /> Add check
      </Button>
      {!branch && <p className="text-[10px] text-muted-foreground">When this fails, the whole run stops here.</p>}
    </div>
  );
}

function VariableEditor({ form, path }: { form: AnyForm; path: string }) {
  const name: string = form.watch(`${path}.name`) ?? '';
  const kind: string = form.watch(`${path}.kind`) ?? 'string';
  const secretPath = `secrets.${name}`;

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          className="h-8 flex-1 font-mono text-xs"
          placeholder="name"
          value={name}
          onChange={(e) => form.setValue(`${path}.name`, e.target.value.replace(/[^a-zA-Z0-9_]/g, ''), { shouldDirty: true })}
          aria-label="Variable name"
        />
        <SmallSelect
          label="Variable kind"
          value={kind}
          onChange={(v) => {
            form.setValue(`${path}.kind`, v, { shouldDirty: true });
            if (v === 'secret') form.setValue(`${path}.value`, undefined);
          }}
          options={[
            { value: 'string', label: 'Text' },
            { value: 'number', label: 'Number' },
            { value: 'boolean', label: 'Yes/No' },
            { value: 'secret', label: 'Secret' },
          ]}
          className="h-8 w-24 text-xs"
        />
      </div>
      {kind === 'secret' ? (
        <>
          <Input
            type="password"
            className="h-8 text-xs"
            placeholder={name ? 'Secret value' : 'Name the variable first'}
            disabled={!name}
            value={name ? form.watch(secretPath) ?? '' : ''}
            onChange={(e) => form.setValue(secretPath, e.target.value, { shouldDirty: true })}
            aria-label="Secret value"
          />
          <p className="text-[10px] text-muted-foreground">
            Stored only on this device. Use it as {'{{'}
            {name || 'name'}
            {'}}'}, including in webhook URLs and headers.
          </p>
        </>
      ) : (
        <Input
          className="h-8 text-xs"
          placeholder="Value (may use {{trigger.…}})"
          value={form.watch(`${path}.value`) ?? ''}
          onChange={(e) => form.setValue(`${path}.value`, e.target.value, { shouldDirty: true })}
          aria-label="Variable value"
        />
      )}
    </div>
  );
}

function DelayEditor({ form, path }: { form: AnyForm; path: string }) {
  const schedule = form.watch(`${path}.schedule`);
  if (!schedule) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 text-xs"
        onClick={() =>
          form.setValue(
            `${path}.schedule`,
            { identifier: `later-${newStepId().slice(-5)}`, delay: { unit: 'm', value: { kind: 'literal', n: 10 } } },
            { shouldDirty: true },
          )
        }
      >
        <Clock className="mr-1 h-3 w-3" /> Run later
      </Button>
    );
  }
  return (
    <div className="space-y-2 rounded-md bg-muted/40 p-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span className="flex-1">Run after</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 text-xs"
          onClick={() => form.setValue(`${path}.schedule`, undefined, { shouldDirty: true })}
        >
          Run now instead
        </Button>
      </div>
      <div className="flex gap-2">
        <Input
          type="number"
          min={0}
          className="h-8 w-20 text-xs"
          value={schedule.delay?.value?.kind === 'literal' ? schedule.delay.value.n : ''}
          onChange={(e) =>
            form.setValue(`${path}.schedule.delay.value`, { kind: 'literal', n: Math.max(0, Math.floor(Number(e.target.value) || 0)) }, { shouldDirty: true })
          }
          aria-label="Delay amount"
        />
        <SmallSelect
          label="Delay unit"
          value={schedule.delay?.unit ?? 'm'}
          onChange={(v) => form.setValue(`${path}.schedule.delay.unit`, v, { shouldDirty: true })}
          options={UNITS}
          className="h-8 flex-1 text-xs"
        />
      </div>
      <Input
        className="h-8 font-mono text-xs"
        placeholder="identifier"
        value={schedule.identifier ?? ''}
        onChange={(e) => form.setValue(`${path}.schedule.identifier`, e.target.value, { shouldDirty: true })}
        aria-label="Schedule identifier"
      />
      <p className="text-[10px] text-muted-foreground">
        A "Cancel scheduled" step with this identifier (in any flow) stops it. If the app is closed when it comes due,
        it runs next time you open it.
      </p>
    </div>
  );
}

const newStep = {
  action: (): FlowStep => ({ type: 'action', id: newStepId(), action: { type: 'LOG', details: {} } }),
  condition: (): FlowStep => ({ type: 'condition', id: newStepId(), assertions: [{ field: '', operator: 'eq', value: '' }] }),
  variable: (): FlowStep => ({ type: 'variable', id: newStepId(), name: '', kind: 'string', value: '' }),
  cancelScheduled: (): FlowStep => ({ type: 'cancelScheduled', id: newStepId(), identifier: '' }),
};

interface ListContext {
  form: AnyForm;
  listId: string;
  /** Total steps in the whole flow (the lexicon caps the total, not each list). */
  full: boolean;
  renderActionDetails: (prefix: string) => ReactNode;
}

/**
 * One list of steps: the flow's top level, or a branch's `then`/`else`. Lists
 * nest through condition steps, so this renders itself recursively. Steps are
 * keyed by their stable id rather than by react-hook-form field-array keys,
 * which don't extend to nested arrays.
 */
function StepList({ ctx, path, depth }: { ctx: ListContext; path: string; depth: number }) {
  const { form, listId, full, renderActionDetails } = ctx;
  const steps: FlowStep[] = form.watch(path) ?? [];
  const setSteps = (next: FlowStep[]) => form.setValue(path, next, { shouldDirty: true });
  const move = (from: number, to: number) => {
    const next = [...steps];
    [next[from], next[to]] = [next[to], next[from]];
    setSteps(next);
  };
  const add = (step: FlowStep) => setSteps([...steps, step]);
  const nested = depth > 1;

  return (
    <div className="space-y-3">
      {steps.map((step, index) => {
        const stepPath = `${path}.${index}`;
        const isBranch = step.type === 'condition' && !!step.then;
        const Icon =
          step.type === 'action' ? ChevronRight : step.type === 'condition' ? (isBranch ? GitBranch : Filter) : step.type === 'variable' ? (step.kind === 'secret' ? Lock : Variable) : XCircle;
        const label = `step ${index + 1}${nested ? ` (level ${depth})` : ''}`;
        const branchChildren = isBranch ? (step.then?.length ?? 0) + (step.else?.length ?? 0) : 0;

        return (
          <div key={step.id} className="space-y-3 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-xs font-medium text-muted-foreground">#{index + 1}</span>
              <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              {step.type === 'action' ? (
                <div className="min-w-0 flex-1">
                  <SmallSelect
                    label={`Action for ${label}`}
                    value={step.action?.type ?? 'LOG'}
                    onChange={(v) => form.setValue(`${stepPath}.action`, { type: v, details: {} }, { shouldDirty: true })}
                    options={ACTION_TYPES.map((t) => ({ value: t, label: ACTION_LABELS[t] }))}
                  />
                </div>
              ) : (
                <span className="flex-1 text-sm font-medium">{isBranch ? 'If' : STEP_LABELS[step.type]}</span>
              )}
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => move(index, index - 1)} disabled={index === 0} aria-label={`Move ${label} up`}>
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => move(index, index + 1)} disabled={index === steps.length - 1} aria-label={`Move ${label} down`}>
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive" onClick={() => setSteps(steps.filter((_, j) => j !== index))} aria-label={`Remove ${label}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            {step.type === 'action' && (
              <>
                {renderActionDetails(`${stepPath}.action`)}
                <DelayEditor form={form} path={stepPath} />
              </>
            )}

            {step.type === 'condition' && (
              <>
                <ConditionEditor form={form} path={stepPath} listId={listId} branch={isBranch} />
                {isBranch ? (
                  <>
                    <BranchList ctx={ctx} path={`${stepPath}.then`} depth={depth + 1} title="Then" />
                    <BranchList ctx={ctx} path={`${stepPath}.else`} depth={depth + 1} title="Otherwise" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={branchChildren > 0}
                      title={branchChildren > 0 ? 'Remove the steps inside first' : undefined}
                      onClick={() => {
                        const { then: _t, else: _e, ...gate } = step;
                        form.setValue(stepPath, gate, { shouldDirty: true });
                      }}
                    >
                      <Filter className="mr-1 h-3 w-3" /> Stop the run instead
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    disabled={depth >= MAX_DEPTH}
                    title={depth >= MAX_DEPTH ? `Branches can nest ${MAX_DEPTH} levels deep` : undefined}
                    onClick={() => form.setValue(stepPath, { ...step, then: [], else: [] }, { shouldDirty: true })}
                  >
                    <GitBranch className="mr-1 h-3 w-3" /> Branch instead (then / otherwise)
                  </Button>
                )}
              </>
            )}

            {step.type === 'variable' && <VariableEditor form={form} path={stepPath} />}
            {step.type === 'cancelScheduled' && (
              <Input
                className="h-8 font-mono text-xs"
                placeholder="identifier to cancel"
                value={form.watch(`${stepPath}.identifier`) ?? ''}
                onChange={(e) => form.setValue(`${stepPath}.identifier`, e.target.value, { shouldDirty: true })}
                aria-label="Identifier to cancel"
              />
            )}
          </div>
        );
      })}

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="sm" disabled={full} onClick={() => add(newStep.action())}>
          <PlusCircle className="mr-2 h-4 w-4" /> Action
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={full} onClick={() => add(newStep.condition())}>
          <Filter className="mr-2 h-4 w-4" /> Condition
        </Button>
        {!nested && (
          <>
            <Button type="button" variant="outline" size="sm" disabled={full} onClick={() => add(newStep.variable())}>
              <Variable className="mr-2 h-4 w-4" /> Variable
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={full} onClick={() => add(newStep.cancelScheduled())}>
              <XCircle className="mr-2 h-4 w-4" /> Cancel scheduled
            </Button>
          </>
        )}
        {nested && (
          <Button type="button" variant="outline" size="sm" disabled={full} onClick={() => add(newStep.cancelScheduled())}>
            <XCircle className="mr-2 h-4 w-4" /> Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

function BranchList({ ctx, path, depth, title }: { ctx: ListContext; path: string; depth: number; title: string }) {
  return (
    <div className="space-y-2 border-l-2 pl-3">
      <p className="text-xs font-semibold text-muted-foreground">{title}</p>
      <StepList ctx={ctx} path={path} depth={depth} />
    </div>
  );
}

export function StepsEditor({
  form: typedForm,
  renderActionDetails,
}: {
  form: UseFormReturn<FlowFormValues>;
  renderActionDetails: (prefix: string) => ReactNode;
}) {
  const form = typedForm as unknown as AnyForm;
  const steps: FlowStep[] = form.watch('steps') ?? [];
  const triggerType: TriggerType = form.watch('trigger.type');
  const listId = 'condition-fields';

  const all = [...walkSteps(steps)].map((s) => s.step);
  const variableNames = all.filter((s) => s.type === 'variable').map((s: any) => s.name).filter(Boolean);
  const suggestions = [
    ...(TRIGGER_DATA_KEYS[triggerType] ?? []).map((k) => `trigger.${k}`),
    ...DEVICE_FIELDS,
    ...variableNames,
  ];

  const ctx: ListContext = { form, listId, full: all.length >= MAX_STEPS, renderActionDetails };

  return (
    <div className="space-y-3">
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <StepList ctx={ctx} path="steps" depth={1} />
      {ctx.full && <p className="text-[10px] text-muted-foreground">A flow can have at most {MAX_STEPS} steps.</p>}
    </div>
  );
}
