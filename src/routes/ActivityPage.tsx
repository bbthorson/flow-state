import { DeviceStatusPanel } from '@/components/DeviceStatusPanel';
import { HistoryList } from '@/components/history-list';
import { VaultSection } from '@/components/vault-section';

export function ActivityPage() {
  return (
    <div className="space-y-4">
      <DeviceStatusPanel />
      <HistoryList />
      <VaultSection />
    </div>
  );
}
