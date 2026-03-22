import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Battery, Wifi, MapPin, Link as LinkIcon, Hand, Bell, Globe, FileText, ArrowLeft, ShieldCheck } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSION_LABELS, DevicePermission, PermissionState } from '@/lib/permissions';

const TRIGGERS = [
  {
    type: 'NATIVE_BATTERY',
    name: 'Battery',
    lexicon: 'app.flowstate.trigger.battery',
    icon: Battery,
    description: 'Fires when your battery level or charging state changes.',
    permissions: ['battery-status'] as DevicePermission[],
    variables: ['level', 'charging'],
  },
  {
    type: 'NETWORK',
    name: 'Network',
    lexicon: 'app.flowstate.trigger.network',
    icon: Wifi,
    description: 'Fires when you go online/offline or connect to a specific Wi-Fi network.',
    permissions: ['network-information'] as DevicePermission[],
    variables: ['online', 'type', 'ssid'],
  },
  {
    type: 'GEOLOCATION',
    name: 'Geolocation',
    lexicon: 'app.flowstate.trigger.geolocation',
    icon: MapPin,
    description: 'Fires when your device enters or exits a geographic zone.',
    permissions: ['geolocation'] as DevicePermission[],
    variables: ['event', 'latitude', 'longitude', 'distance'],
  },
  {
    type: 'DEEP_LINK',
    name: 'Deep Link',
    lexicon: 'app.flowstate.trigger.deepLink',
    icon: LinkIcon,
    description: 'Fires when the app is opened via a URL with matching query parameters.',
    permissions: [] as DevicePermission[],
    variables: ['any key from URL params'],
  },
  {
    type: 'MANUAL',
    name: 'Manual',
    lexicon: 'app.flowstate.trigger.manual',
    icon: Hand,
    description: 'Fires when you tap the play button on a flow.',
    permissions: [] as DevicePermission[],
    variables: [],
  },
];

const ACTIONS = [
  {
    type: 'WEBHOOK',
    name: 'Webhook',
    lexicon: 'app.flowstate.action.webhook',
    icon: Globe,
    description: 'Sends an HTTP request to any URL. Supports template variables in the URL and body.',
    permissions: [] as DevicePermission[],
  },
  {
    type: 'NOTIFICATION',
    name: 'Notification',
    lexicon: 'app.flowstate.action.notification',
    icon: Bell,
    description: 'Shows a browser notification with a customizable title and body.',
    permissions: ['notifications'] as DevicePermission[],
  },
  {
    type: 'LOG',
    name: 'Log',
    lexicon: 'app.flowstate.action.log',
    icon: FileText,
    description: 'Records a message to the activity log.',
    permissions: [] as DevicePermission[],
  },
];

function PermissionStateBadge({ permission, state }: { permission: DevicePermission; state: PermissionState }) {
  const label = PERMISSION_LABELS[permission];
  const colors = {
    granted: 'bg-green-500/10 text-green-700 dark:text-green-400',
    prompt: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
    denied: 'bg-red-500/10 text-red-700 dark:text-red-400',
    unavailable: 'bg-muted text-muted-foreground',
  };

  return (
    <Badge variant="outline" className={`text-[10px] ${colors[state]}`}>
      {label}: {state}
    </Badge>
  );
}

export function HowFlowsWorkPage() {
  const permissions = usePermissions();

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link to="/discover">
            <ArrowLeft className="mr-1 h-3 w-3" />
            Back to Discover
          </Link>
        </Button>
        <h2 className="text-2xl font-bold tracking-tight">How Flows Work</h2>
        <p className="text-muted-foreground">
          Flows are on-device automations that connect a trigger to one or more actions.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">What is a Flow?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            A flow has two parts: a <strong className="text-foreground">trigger</strong> (the event that starts it)
            and one or more <strong className="text-foreground">actions</strong> (what happens when it fires).
          </p>
          <p>
            Everything runs on your device. No data is sent to any server unless you add a webhook action.
          </p>
        </CardContent>
      </Card>

      <div>
        <h3 className="text-lg font-semibold mb-3">Triggers</h3>
        <div className="space-y-3">
          {TRIGGERS.map((trigger) => {
            const Icon = trigger.icon;
            return (
              <Card key={trigger.type}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-md bg-muted p-2 mt-0.5">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-grow space-y-2">
                      <div>
                        <h4 className="font-medium">{trigger.name}</h4>
                        <p className="text-sm text-muted-foreground">{trigger.description}</p>
                      </div>
                      {trigger.permissions.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          <span className="text-[10px] text-muted-foreground mr-1">Requires:</span>
                          {trigger.permissions.map((p) => (
                            <PermissionStateBadge key={p} permission={p} state={permissions[p]} />
                          ))}
                        </div>
                      )}
                      {trigger.variables.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          <span className="text-[10px] text-muted-foreground mr-1">Variables:</span>
                          {trigger.variables.map((v) => (
                            <Badge key={v} variant="secondary" className="text-[10px] py-0 px-1 font-mono">
                              {`{{${v}}}`}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <p className="text-[10px] font-mono text-muted-foreground/60">{trigger.lexicon}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Actions</h3>
        <div className="space-y-3">
          {ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <Card key={action.type}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-md bg-muted p-2 mt-0.5">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-grow space-y-2">
                      <div>
                        <h4 className="font-medium">{action.name}</h4>
                        <p className="text-sm text-muted-foreground">{action.description}</p>
                      </div>
                      {action.permissions.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          <span className="text-[10px] text-muted-foreground mr-1">Requires:</span>
                          {action.permissions.map((p) => (
                            <PermissionStateBadge key={p} permission={p} state={permissions[p]} />
                          ))}
                        </div>
                      )}
                      <p className="text-[10px] font-mono text-muted-foreground/60">{action.lexicon}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            <CardTitle className="text-lg">Your Permissions</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Some triggers and actions need browser permissions to work. Here's your current status:
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(permissions) as [DevicePermission, PermissionState][]).map(([perm, state]) => (
              <div key={perm} className="flex items-center justify-between rounded-md border p-2">
                <span className="text-xs font-medium">{PERMISSION_LABELS[perm]}</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    state === 'granted'
                      ? 'text-green-600'
                      : state === 'prompt'
                        ? 'text-yellow-600'
                        : 'text-red-600'
                  }`}
                >
                  {state}
                </Badge>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Permissions set to "denied" can be re-enabled in your browser's site settings.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sharing Flows (Coming Soon)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Every flow is defined using an{' '}
            <strong className="text-foreground">AT Protocol Lexicon</strong> — a self-describing
            schema that specifies what the flow needs and how it works.
          </p>
          <p>
            In the future, you'll be able to publish flows to the AT Protocol network
            and discover automations shared by other users — like an app store for on-device
            automations.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
