import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAppStore } from '@/store/useAppStore';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Zap, ChevronRight, Plus, ChevronUp, Compass } from 'lucide-react';

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
            <div className="flex flex-col items-center text-center py-10 gap-3">
              <div className="rounded-full bg-muted p-4">
                <Zap className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">No flows yet</p>
                <p className="text-xs text-muted-foreground">
                  Create your first automation to get started.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {flows.map((flow) => (
                <button
                  key={flow.id}
                  className="w-full flex items-center justify-between py-3 text-left"
                  onClick={() => handleFlowTap(flow.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Switch
                      checked={flow.enabled}
                      onCheckedChange={(enabled) => updateFlow({ ...flow, enabled })}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="text-sm font-medium truncate">{flow.name}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                </button>
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
