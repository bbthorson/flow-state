import { CalendarDays } from 'lucide-react';
import { Card } from '@/components/ui/card';

export function TimelinePage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Timeline</h2>
        <p className="text-muted-foreground">Your day as a continuous stream of intent.</p>
      </div>
      <Card>
        <div className="flex flex-col items-center text-center p-10 space-y-4">
          <div className="rounded-full bg-muted p-4">
            <CalendarDays className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Coming in Phase 2</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              A rolling 12-hour view of your calendar blocks, protected spaces, and triage windows — with your flows woven in as live context.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
