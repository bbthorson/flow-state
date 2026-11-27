import type { RunTrace } from '@flowstate/core';
import { CheckCircle2, XCircle, PauseCircle, FlaskConical, ShieldAlert } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'ok':
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-600 shrink-0" />;
    case 'paused':
      return <PauseCircle className="h-4 w-4 text-amber-600 shrink-0" />;
    case 'dry-run':
      return <FlaskConical className="h-4 w-4 text-sky-600 shrink-0" />;
    default:
      return <ShieldAlert className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
}

/**
 * Structured Run Trace Inspector ("No Magic"):
 * displays the triggering event, trust level, and step-by-step evaluation waterfall.
 */
export function TraceViewer({
  trace,
  open,
  onOpenChange,
}: {
  trace: RunTrace | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[82vh] overflow-y-auto">
        {trace && (
          <div className="space-y-4">
            <SheetHeader className="text-left">
              <div className="flex items-center gap-2">
                <StatusIcon status={trace.status} />
                <SheetTitle className="text-base">{trace.flowName}</SheetTitle>
                <Badge variant="outline" className="text-[10px] uppercase">
                  {trace.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Triggered by <code className="font-mono">{trace.triggerEvent.type}</code> · source:{' '}
                {trace.triggerEvent.source} · trust:{' '}
                <span className={trace.triggerEvent.trust === 'untrusted' ? 'text-amber-600 font-medium' : ''}>
                  {trace.triggerEvent.trust}
                </span>
              </p>
            </SheetHeader>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Step Waterfall ({trace.steps.length})
              </h4>
              {trace.steps.length === 0 ? (
                <p className="text-xs text-muted-foreground">No steps executed.</p>
              ) : (
                <div className="divide-y rounded-md border">
                  {trace.steps.map((step, i) => (
                    <div key={`${step.stepId}-${i}`} className="flex items-start gap-3 p-3">
                      <StatusIcon status={step.status} />
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium uppercase text-muted-foreground">{step.kind}</span>
                          {step.branch && (
                            <Badge variant="secondary" className="text-[10px]">
                              {step.branch}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm">{step.summary}</p>
                        {step.error && <p className="text-xs text-red-600">{step.error}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
