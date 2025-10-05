import { BatteryCharging, Smartphone } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

type StatusSectionProps = {
  charging: boolean | null;
  faceDown: boolean | null;
  lastSentTime: Date | null;
  lastStatus: 'Sent successfully' | 'Failed' | null;
};

export function StatusSection({ charging, faceDown, lastSentTime, lastStatus }: StatusSectionProps) {
  return (
    <section className="flex flex-col items-center justify-center flex-grow w-full p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <BatteryCharging className={`w-10 h-10 ${charging ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className="text-xl font-medium">Charging</span>
          </div>
          <span className={`text-2xl font-semibold ${charging ? 'text-primary' : 'text-muted-foreground'}`}>
            {charging ? 'Yes' : 'No'}
          </span>
        </div>
        <Separator />
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <Smartphone className={`w-10 h-10 ${faceDown ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className="text-xl font-medium">Face Down</span>
          </div>
          <span className={`text-2xl font-semibold ${faceDown ? 'text-primary' : 'text-muted-foreground'}`}>
            {faceDown ? 'Yes' : 'No'}
          </span>
        </div>
      </div>
      <div className="mt-auto pt-8 text-center text-sm text-muted-foreground">
        <p>Last Webhook Sent: {lastSentTime ? lastSentTime.toLocaleString() : 'Never'}</p>
        <p>Status: <span className="font-bold">{lastStatus || 'Unknown'}</span></p>
      </div>
    </section>
  );
}
