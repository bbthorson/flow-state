import { Crosshair } from 'lucide-react';
import { Card } from '@/components/ui/card';

export function ExecutionPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Execution</h2>
        <p className="text-muted-foreground">A single, focused workspace — one app, one intent.</p>
      </div>
      <Card>
        <div className="flex flex-col items-center text-center p-10 space-y-4">
          <div className="rounded-full bg-muted p-4">
            <Crosshair className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Coming in Phase 3</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              An isolated canvas locked to a single booked session, with a countdown and a settlement gate when your time is up.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
