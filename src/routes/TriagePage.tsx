import { Inbox } from 'lucide-react';
import { Card } from '@/components/ui/card';

export function TriagePage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Triage</h2>
        <p className="text-muted-foreground">Incoming tasks and notifications, stripped and sorted.</p>
      </div>
      <Card>
        <div className="flex flex-col items-center text-center p-10 space-y-4">
          <div className="rounded-full bg-muted p-4">
            <Inbox className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">No tasks yet</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              In a future phase, this feed will intercept your notifications, strip brand noise, and surface them as uniform tasks to schedule or dismiss.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
