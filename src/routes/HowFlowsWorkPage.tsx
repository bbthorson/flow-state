import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Battery, Wifi, MapPin, Link as LinkIcon, Hand, Bell, Globe, FileText, ArrowLeft, Timer, Smartphone, RotateCw, Vibrate, Clipboard, Share2, Sun, Volume2, CalendarClock, Radio } from 'lucide-react';
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
    variables: ['level', 'charging', 'previous.level'],
  },
  {
    type: 'NETWORK',
    name: 'Network',
    lexicon: 'app.flowstate.trigger.network',
    icon: Wifi,
    description: 'Fires when you go online or offline.',
    permissions: ['network-information'] as DevicePermission[],
    variables: ['online'],
  },
  {
    type: 'GEOLOCATION',
    name: 'Geolocation',
    lexicon: 'app.flowstate.trigger.geolocation',
    icon: MapPin,
    description: 'Fires when your device enters or exits a geographic zone.',
    permissions: ['geolocation'] as DevicePermission[],
    variables: ['event', 'distance'],
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
  {
    type: 'TIME',
    name: 'Schedule',
    lexicon: 'app.flowstate.trigger.schedule',
    icon: CalendarClock,
    description: 'Fires at a set time on chosen days — while the app is open. A PWA cannot wake in the background, so if the app is closed at the scheduled minute the flow waits for the next occurrence.',
    permissions: [] as DevicePermission[],
    variables: ['time', 'date', 'day', 'timestamp'],
  },
  {
    type: 'IDLE',
    name: 'Idle Detection',
    lexicon: 'app.flowstate.trigger.idle',
    icon: Timer,
    description: 'Fires when the user has been idle for a specified duration, or when the screen locks.',
    permissions: ['idle-detection'] as DevicePermission[],
    variables: ['userState', 'screenState'],
  },
  {
    type: 'DEVICE_MOTION',
    name: 'Device Motion',
    lexicon: 'app.flowstate.trigger.motion',
    icon: Smartphone,
    description: 'Fires on physical gestures like shaking the device or placing it face down.',
    permissions: ['device-motion'] as DevicePermission[],
    variables: ['gesture'],
  },
  {
    type: 'SCREEN_ORIENTATION',
    name: 'Screen Orientation',
    lexicon: 'app.flowstate.trigger.orientation',
    icon: RotateCw,
    description: 'Fires when the device rotates between portrait and landscape.',
    permissions: ['screen-orientation'] as DevicePermission[],
    variables: ['orientation', 'angle'],
  },
  {
    type: 'EVENT',
    name: 'Event',
    lexicon: 'app.flowstate.trigger.event',
    icon: Radio,
    description: 'Fires when another flow on this device emits a matching event. Only the data keys you list are readable.',
    permissions: [] as DevicePermission[],
    variables: ['event', 'title', 'body', 'data.<key>'],
  },
];

const ACTIONS = [
  {
    type: 'WEBHOOK',
    name: 'Webhook',
    lexicon: 'app.flowstate.action.webhook',
    icon: Globe,
    description: 'Sends an HTTP request to any URL. Trigger data can be used in the body; the URL and headers only take secret variables.',
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
  {
    type: 'VIBRATION',
    name: 'Vibration',
    lexicon: 'app.flowstate.action.vibration',
    icon: Vibrate,
    description: 'Vibrates the device for a specified duration or pattern.',
    permissions: ['vibration'] as DevicePermission[],
  },
  {
    type: 'CLIPBOARD',
    name: 'Copy to Clipboard',
    lexicon: 'app.flowstate.action.clipboard',
    icon: Clipboard,
    description: 'Copies text to the system clipboard. Supports template variables.',
    permissions: ['clipboard-write'] as DevicePermission[],
  },
  {
    type: 'WEB_SHARE',
    name: 'Share',
    lexicon: 'app.flowstate.action.share',
    icon: Share2,
    description: 'Opens the system share sheet with customizable title, text, and URL.',
    permissions: ['web-share'] as DevicePermission[],
  },
  {
    type: 'WAKE_LOCK',
    name: 'Wake Lock',
    lexicon: 'app.flowstate.action.wakeLock',
    icon: Sun,
    description: 'Keeps the screen awake for a specified duration or until released.',
    permissions: ['wake-lock'] as DevicePermission[],
  },
  {
    type: 'SPEECH',
    name: 'Text to Speech',
    lexicon: 'app.flowstate.action.speech',
    icon: Volume2,
    description: 'Speaks text aloud with configurable rate, pitch, and volume.',
    permissions: ['speech-synthesis'] as DevicePermission[],
  },
  {
    type: 'EMIT_EVENT',
    name: 'Emit event',
    lexicon: 'app.flowstate.action.emitEvent',
    icon: Radio,
    description: 'Emits a named event that other flows can react to. Chains stop after five hops.',
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
    <div className="space-y-4">
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
            A flow has a <strong className="text-foreground">trigger</strong> (the event that starts it)
            and a list of <strong className="text-foreground">steps</strong> that run in order when it fires:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong className="text-foreground">Actions</strong> do something. Any action can run later instead of now ("in 10 minutes").</li>
            <li><strong className="text-foreground">Conditions</strong> check something — <span className="font-mono text-xs">device.battery.charging = false</span>, <span className="font-mono text-xs">time.hour ≥ 8</span> — and stop the run when it doesn't hold.</li>
            <li><strong className="text-foreground">Variables</strong> name a value once. Secret variables stay on this device and are the only way to put a token in a webhook URL or header.</li>
            <li><strong className="text-foreground">Cancel scheduled</strong> stops a delayed action by its identifier — "remind me unless I get home first".</li>
          </ul>
          <p>
            Text fields can use <span className="font-mono text-xs">{'{{trigger.…}}'}</span>, <span className="font-mono text-xs">{'{{device.…}}'}</span>,{' '}
            <span className="font-mono text-xs">{'{{time.…}}'}</span> and variables by name. Trigger data is never allowed into a
            webhook URL or header, so a deep link can't redirect your webhooks. Turn on <strong className="text-foreground">dry run</strong> to
            see what a flow would do without it doing anything.
          </p>
          <p>
            Everything runs on your device. No data is sent to any server unless you add a webhook action.
          </p>
        </CardContent>
      </Card>

      <div>
        <h3 className="text-lg font-semibold mb-3">Triggers</h3>
        <Card>
          <div className="divide-y">
            {TRIGGERS.map((trigger) => {
              const Icon = trigger.icon;
              return (
                <div key={trigger.type} className="flex items-start gap-3 p-4">
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
                            {`{{trigger.${v}}}`}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] font-mono text-muted-foreground/60">{trigger.lexicon}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Actions</h3>
        <Card>
          <div className="divide-y">
            {ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <div key={action.type} className="flex items-start gap-3 p-4">
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
              );
            })}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sharing Flows</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Every flow is defined using an{' '}
            <strong className="text-foreground">AT Protocol Lexicon</strong> — a self-describing
            schema that specifies what the flow needs and how it works.
          </p>
          <p>
            When you <strong className="text-foreground">publish</strong> a flow, its definition
            is written to your personal data repository on the AT Protocol network, tied to your
            Bluesky identity. Other users can browse published flows and install them locally.
          </p>
          <p>
            <strong className="text-foreground">Installing</strong> a flow creates a local copy
            on your device. You own it completely — edit, disable, or delete it at any time. Installing
            writes nothing to the network: nobody is told you installed it.
          </p>
          <p>
            Your data stays yours. Flows run entirely on-device, and your Bluesky account is only
            used for identity and publishing — never for accessing your personal data.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
