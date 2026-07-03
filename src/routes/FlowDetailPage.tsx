import { useState } from 'react';
import { useParams, useNavigate, Navigate, Link } from 'react-router';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';
import { usePermissions } from '@/hooks/usePermissions';
import { getFlowPermissions, PERMISSION_LABELS } from '@/lib/permissions';
import { TRIGGER_LABELS, ACTION_LABELS } from '@/lib/flow-constants';
import { formatSchedule } from '@/lib/schedule';
import { Flow, TriggerType } from '@/types';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { FlowForm } from '@/components/flow-form';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  Play,
  Pencil,
  Trash2,
  Globe,
  GlobeLock,
  ShieldAlert,
  ChevronRight,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const MOCK_DATA: Record<TriggerType, Record<string, any>> = {
  NATIVE_BATTERY: { level: 0.5, charging: true },
  NETWORK: { online: true, ssid: 'Mock-WiFi', type: 'wifi' },
  GEOLOCATION: { latitude: 0, longitude: 0, distance: 0, event: 'ENTER' },
  DEEP_LINK: { event: 'TEST', custom: 'data' },
  MANUAL: {},
  IDLE: { userState: 'idle', screenState: 'unlocked' },
  DEVICE_MOTION: { gesture: 'SHAKE', accelerationX: 0, accelerationY: 0, accelerationZ: 15 },
  SCREEN_ORIENTATION: { orientation: 'landscape', angle: 90 },
  TIME: { time: '09:00', date: 'Jan 1, 2026', day: 'Mon' },
};

function triggerSummary(flow: Flow): string {
  const d = flow.trigger.details;
  switch (flow.trigger.type) {
    case 'NATIVE_BATTERY':
      return `Battery ${d.charging ? 'charging' : 'discharging'} at ${Math.round((d.level ?? 0) * 100)}%`;
    case 'NETWORK':
      return d.ssid ? `Connected to ${d.ssid}` : d.online ? 'Network online' : 'Network offline';
    case 'GEOLOCATION':
      return `${d.event === 'ENTER' ? 'Enter' : 'Exit'} zone (${d.radius ?? 0}m radius)`;
    case 'DEEP_LINK':
      return `Deep link: ${d.event ?? 'any'}`;
    case 'IDLE':
      return `Idle after ${Math.round((d.threshold ?? 60000) / 1000)}s`;
    case 'DEVICE_MOTION':
      return `Gesture: ${d.gesture ?? 'any'}`;
    case 'SCREEN_ORIENTATION':
      return `Orientation: ${d.orientation ?? 'any'}`;
    case 'MANUAL':
      return 'Triggered manually';
    case 'TIME':
      return formatSchedule(d);
    default:
      return '';
  }
}

export function FlowDetailPage() {
  const { flowId } = useParams<{ flowId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const flows = useAppStore((s) => s.flows);
  const updateFlow = useAppStore((s) => s.updateFlow);
  const deleteFlow = useAppStore((s) => s.deleteFlow);
  const triggerFlows = useAppStore((s) => s.triggerFlows);

  const agent = useAuthStore((s) => s.agent);
  const publishedFlows = useAuthStore((s) => s.publishedFlows);
  const publishFlow = useAuthStore((s) => s.publishFlow);
  const unpublishFlow = useAuthStore((s) => s.unpublishFlow);

  const permissions = usePermissions();

  const flow = flows.find((f) => f.id === flowId);

  if (!flow) return <Navigate to="/" replace />;

  if (isEditing) {
    return (
      <FlowForm
        flow={flow}
        onSave={(data) => {
          updateFlow({ ...data, id: flow.id });
          setIsEditing(false);
        }}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  const isPublished = !!publishedFlows[flow.id];
  const requiredPerms = getFlowPermissions(flow);
  const unmetPerms = requiredPerms.filter((p) => permissions[p] !== 'granted');

  const handleToggle = (enabled: boolean) => updateFlow({ ...flow, enabled });

  const handleTest = () => {
    triggerFlows(flow.trigger.type, MOCK_DATA[flow.trigger.type], flow.id);
    toast({ title: 'Test triggered', description: `Running "${flow.name}" with mock data.` });
  };

  const handleDelete = () => {
    deleteFlow(flow.id);
    navigate('/');
  };

  const handlePublishToggle = async () => {
    setPublishing(true);
    try {
      if (isPublished) {
        await unpublishFlow(flow.id);
        toast({ title: 'Unpublished', description: `"${flow.name}" removed from the network.` });
      } else {
        await publishFlow(flow);
        toast({ title: 'Published', description: `"${flow.name}" is now visible on the AT Protocol network.` });
      }
    } catch (err) {
      toast({
        title: isPublished ? 'Unpublish failed' : 'Publish failed',
        description: err instanceof Error ? err.message : 'Something went wrong.',
        variant: 'destructive',
      });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h2 className="text-2xl font-bold tracking-tight flex-1 truncate">{flow.name}</h2>
        <Switch checked={flow.enabled} onCheckedChange={handleToggle} />
      </div>

      {unmetPerms.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950 p-3 text-sm text-yellow-700 dark:text-yellow-400">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>Needs {unmetPerms.map((p) => PERMISSION_LABELS[p]).join(', ')}</span>
        </div>
      )}

      <div className="rounded-md border divide-y">
        <div className="p-4 space-y-0.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trigger</p>
          <p className="text-sm font-medium">{TRIGGER_LABELS[flow.trigger.type]}</p>
          <p className="text-xs text-muted-foreground">{triggerSummary(flow)}</p>
        </div>

        <div className="p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Actions ({flow.actions.length})
          </p>
          {flow.actions.map((action, i) => (
            <div key={i} className="flex items-center gap-2">
              <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-sm">{ACTION_LABELS[action.type]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={handleTest}>
            <Play className="mr-2 h-4 w-4" />
            Test
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => setIsEditing(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </div>

        {agent && (
          <Button
            variant="outline"
            onClick={handlePublishToggle}
            disabled={publishing}
          >
            {isPublished
              ? <><Globe className="mr-2 h-4 w-4 text-green-500" />Unpublish from network</>
              : <><GlobeLock className="mr-2 h-4 w-4" />Publish to network</>
            }
          </Button>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="text-destructive hover:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete flow
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{flow.name}"?</AlertDialogTitle>
              <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
