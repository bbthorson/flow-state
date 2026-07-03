import { useAppStore } from '@/store/useAppStore';
import { DeviceStatusPanel } from '@/components/DeviceStatusPanel';
import { DayTimeline } from '@/components/day-timeline';
import { CheckCircle2, XCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function RecentActivity() {
  const logs = useAppStore((state) => state.logs);
  const recent = logs.slice(0, 5);

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">Recent activity</h3>
      {recent.length === 0 ? (
        <p className="text-xs text-muted-foreground">Events will appear here as your flows trigger.</p>
      ) : (
        <div className="rounded-md border divide-y">
          {recent.map((log) => (
            <div key={log.id} className="flex items-start gap-3 p-3">
              {log.status === 'success' && <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />}
              {log.status === 'failure' && <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />}
              {log.status !== 'success' && log.status !== 'failure' && <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm truncate', { 'text-red-500': log.status === 'failure' })}>{log.message}</p>
                <p className="text-[10px] text-muted-foreground">{timeAgo(log.timestamp)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function TimelinePage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Today</h2>
        <p className="text-muted-foreground text-sm">Your day, live device state, and recent activity.</p>
      </div>
      <DayTimeline />
      <DeviceStatusPanel />
      <RecentActivity />
    </div>
  );
}
