import { ChevronRight, Clock, Filter, GitBranch, Lock, Variable, XCircle } from 'lucide-react';
import type { FlowStep } from '@/types';
import { ACTION_LABELS } from '@/lib/flow-constants';
import { describeAssertion, describeDelay } from '@/lib/steps';

function StepRow({ step, depth }: { step: FlowStep; depth: number }) {
  const indent = { paddingLeft: `${depth * 16}px` };
  switch (step.type) {
    case 'condition': {
      const joiner = (step.match ?? 'all') === 'any' ? ' or ' : ' and ';
      const text = step.assertions.map(describeAssertion).join(joiner);
      return (
        <>
          <div className="flex items-start gap-2" style={indent}>
            {step.then ? (
              <GitBranch className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
            ) : (
              <Filter className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
            )}
            <span className="text-sm">
              <span className="text-muted-foreground">{step.then ? 'If ' : 'Only if '}</span>
              <span className="font-mono text-xs">{text}</span>
            </span>
          </div>
          {step.then?.map((s) => <StepRow key={s.id} step={s} depth={depth + 1} />)}
          {step.else && step.else.length > 0 && (
            <>
              <div className="text-xs text-muted-foreground" style={{ paddingLeft: `${depth * 16 + 20}px` }}>
                Otherwise
              </div>
              {step.else.map((s) => <StepRow key={s.id} step={s} depth={depth + 1} />)}
            </>
          )}
        </>
      );
    }
    case 'variable':
      return (
        <div className="flex items-center gap-2" style={indent}>
          {step.kind === 'secret' ? (
            <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
          ) : (
            <Variable className="h-3 w-3 shrink-0 text-muted-foreground" />
          )}
          <span className="text-sm">
            <span className="font-mono text-xs">{step.name}</span>
            <span className="text-muted-foreground">
              {step.kind === 'secret' ? ' (secret)' : step.value ? ` = ${step.value}` : ' (not set)'}
            </span>
          </span>
        </div>
      );
    case 'action':
      return (
        <div className="flex items-center gap-2" style={indent}>
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="text-sm">{ACTION_LABELS[step.action.type] ?? step.action.type}</span>
          {step.schedule && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              after {describeDelay(step.schedule.delay)}
            </span>
          )}
        </div>
      );
    case 'cancelScheduled':
      return (
        <div className="flex items-center gap-2" style={indent}>
          <XCircle className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="text-sm">
            Cancel scheduled <span className="font-mono text-xs">{step.identifier}</span>
          </span>
        </div>
      );
  }
}

export function StepsSummary({ steps }: { steps: FlowStep[] }) {
  if (steps.length === 0) return <p className="text-xs text-muted-foreground">No steps yet.</p>;
  return (
    <div className="space-y-2">
      {steps.map((step) => (
        <StepRow key={step.id} step={step} depth={0} />
      ))}
    </div>
  );
}
