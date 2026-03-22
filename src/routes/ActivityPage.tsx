import { useAppStore } from '@/store/useAppStore';
import { DeviceStatusPanel } from '@/components/DeviceStatusPanel';
import { HistoryList } from '@/components/history-list';
import { VaultSection } from '@/components/vault-section';

export function ActivityPage() {
  const hasFlows = useAppStore((state) => state.flows.length > 0);
  const hasLogs = useAppStore((state) => state.logs.length > 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Activity</h2>
        <p className="text-muted-foreground">Device status and flow execution history.</p>
      </div>
      <DeviceStatusPanel />
      <HistoryList />
      {(hasFlows || hasLogs) && <VaultSection />}
    </div>
  );
}
