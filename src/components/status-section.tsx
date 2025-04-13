import {BatteryCharging, Battery, Phone} from 'lucide-react';
import {Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card';
import {useState} from 'react';

type StatusSectionProps = {
  charging: boolean | null;
  faceDown: boolean | null;
};

export function StatusSection({charging, faceDown}: StatusSectionProps) {
  const [lastWebhookSent, setLastWebhookSent] = useState<string | null>(null);

  return (
    <section className="mb-8 w-full max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Device Status</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p>
            This application uses phone status indicators to send a webhook to the
            URL of your choice. The intention is that you can use that webhook to
            programmatically update your other services to pause or unpause
            notifications.
          </p>
          <div className="flex items-center justify-between">
            <span>Charging Status:</span>
            {charging === null ? (
              <span>N/A</span>
            ) : charging ? (
              <div className="flex items-center gap-2">
                <BatteryCharging className="h-5 w-5 text-green-500" />
                <span>Charging</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Battery className="h-5 w-5 text-red-500" />
                <span>Discharging</span>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span>Orientation:</span>
            {faceDown === null ? (
              <span>N/A</span>
            ) : faceDown ? (
              <div className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                <span>Face Down</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                <span>Face Up</span>
              </div>
            )}
          </div>
          {lastWebhookSent && (
            <div>
              <span>Last Webhook Sent:</span>
              <span>{lastWebhookSent}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
