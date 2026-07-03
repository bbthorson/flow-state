import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAppStore } from '@/store/useAppStore';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Zap, ChevronRight, Plus, ChevronUp, Compass } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';

export function FlowsSheet() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const flows = useAppStore((s) => s.flows);
  const updateFlow = useAppStore((s) => s.updateFlow);
  const addFlow = useAppStore((s) => s.addFlow);

  const enabledCount = flows.filter((f) => f.enabled).length;

  const handleFlowTap = (flowId: string) => {
    setOpen(false);
    navigate(`/flows/${flowId}`);
  };

  const handleNew = () => {
    setOpen(false);
    const id = addFlow({
      name: 'New Flow',
      enabled: false,
      trigger: { type: 'MANUAL', details: {} },
      actions: [],
    });
    navigate(`/flows/${id}`);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="fixed bottom-0 inset-x-0 z-30 bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            <span className="text-sm font-medium">Flows</span>
            {flows.length > 0 && (
              <span className="text-xs opacity-75">
                {enabledCount}/{flows.length} active
              </span>
            )}
          </div>
          <ChevronUp className="h-4 w-4 opacity-75" />
        </button>
      </SheetTrigger>

      <SheetContent side="bottom" className="h-[70vh] flex flex-col">
        <SheetHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <SheetTitle>Flows</SheetTitle>
          <Button size="sm" variant="outline" onClick={handleNew}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            New
          </Button>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {flows.length === 0 ? (
            <EmptyState
              icon={Zap}
              title="No flows yet"
              description="Create your first automation to get started."
            />
          ) : (
            <div className="divide-y">
              {flows.map((flow) => (
                <div key={flow.id} className="flex items-center gap-3 py-3">
                  <Switch
                    checked={flow.enabled}
                    onCheckedChange={(enabled) => updateFlow({ ...flow, enabled })}
                    aria-label={`Enable ${flow.name}`}
                  />
                  <button
                    className="flex min-w-0 flex-1 items-center justify-between text-left"
                    onClick={() => handleFlowTap(flow.id)}
                  >
                    <span className="text-sm font-medium truncate">{flow.name}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-3 border-t -mx-6 px-6">
          <Link
            to="/discover"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            <Compass className="h-4 w-4" />
            Browse starter flows in Discover
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
