import { DeviceStatusPanel } from '@/components/DeviceStatusPanel';
import { HistoryList } from '@/components/history-list';

export function ActivityPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Activity</h2>
        <p className="text-muted-foreground">Device status and flow execution history.</p>
      </div>
      <DeviceStatusPanel />
      <HistoryList />
    </div>
  );
}
