import { DeviceStatusPanel } from '@/components/DeviceStatusPanel';
import { VaultSection } from '@/components/vault-section';
import { HistoryList } from '@/components/history-list';

export function StatusPage() {
  return (
    <div className="space-y-4">
      <DeviceStatusPanel />
      <VaultSection />
      <HistoryList />
    </div>
  );
}
