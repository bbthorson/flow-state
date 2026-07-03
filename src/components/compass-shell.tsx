import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { TimelinePage } from '@/routes/TimelinePage';
import { FlowsSheet } from '@/components/flows-sheet';
import { ControlDrawer } from '@/components/control-drawer';

/**
 * The home surface: the Timeline day view, framed by a stable header (brand +
 * Control drawer) and the swipe-up Flows drawer. Secondary surfaces (Discover,
 * flow detail, docs) are drill-in routes; Settings lives in the Control drawer.
 */
export function CompassShell() {
  const [controlOpen, setControlOpen] = useState(false);
  const [params, setParams] = useSearchParams();

  // Allow other surfaces to deep-link the Control drawer open via `?panel=control`.
  useEffect(() => {
    if (params.get('panel') === 'control') {
      setControlOpen(true);
      params.delete('panel');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  return (
    <div className="relative h-dvh overflow-hidden">
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between border-b bg-background/80 px-3 py-2 backdrop-blur">
        <span className="text-sm font-semibold tracking-tight">Flow State</span>
        <ControlDrawer open={controlOpen} onOpenChange={setControlOpen} />
      </header>

      <div className="h-full overflow-y-auto px-4 pb-24 pt-16">
        <TimelinePage />
      </div>

      <FlowsSheet />
    </div>
  );
}
