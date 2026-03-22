import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
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
import { Flow, TriggerType } from '@/types';
import { Link, Trash2, Pencil, Plus, Play, Zap, ShieldAlert, Globe, GlobeLock } from 'lucide-react';
import { useNavigate } from 'react-router';
import { FlowForm } from '@/components/flow-form';
import { usePermissions } from '@/hooks/usePermissions';
import { getFlowPermissions, PERMISSION_LABELS } from '@/lib/permissions';
import { useToast } from '@/hooks/use-toast';

const MOCK_DATA: Record<TriggerType, any> = {
  NATIVE_BATTERY: { level: 0.5, charging: true },
  NETWORK: { online: true, ssid: 'Mock-WiFi', type: 'wifi' },
  GEOLOCATION: { latitude: 0, longitude: 0, distance: 0, event: 'ENTER' },
  DEEP_LINK: { event: 'TEST', custom: 'data' },
  MANUAL: {},
  IDLE: { userState: 'idle', screenState: 'unlocked' },
  DEVICE_MOTION: { gesture: 'SHAKE', accelerationX: 0, accelerationY: 0, accelerationZ: 15 },
  SCREEN_ORIENTATION: { orientation: 'landscape', angle: 90 },
};

function FlowListItem({ flow, onEdit, permissions }: { flow: Flow, onEdit: () => void, permissions: Record<string, string> }) {
  const { updateFlow, deleteFlow, triggerFlows } = useAppStore();
  const agent = useAuthStore((s) => s.agent);
  const publishedFlows = useAuthStore((s) => s.publishedFlows);
  const publishFlow = useAuthStore((s) => s.publishFlow);
  const unpublishFlow = useAuthStore((s) => s.unpublishFlow);
  const { toast } = useToast();
  const [publishing, setPublishing] = useState(false);

  const isPublished = !!publishedFlows[flow.id];

  const requiredPerms = getFlowPermissions(flow);
  const unmetPerms = requiredPerms.filter((p) => permissions[p] !== 'granted');

  const handleToggle = (enabled: boolean) => {
    updateFlow({ ...flow, enabled });
  };

  const handleDelete = () => {
    deleteFlow(flow.id);
  };

  const handleTest = () => {
    triggerFlows(flow.trigger.type, MOCK_DATA[flow.trigger.type], flow.id);
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
        title: isPublished ? 'Unpublish Failed' : 'Publish Failed',
        description: err instanceof Error ? err.message : 'Something went wrong.',
        variant: 'destructive',
      });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex items-center gap-4">
        <Link className="h-5 w-5 text-muted-foreground" />
        <div>
          <span className="font-medium">{flow.name}</span>
          <div className="flex items-center gap-2">
            {isPublished && (
              <span className="text-[10px] text-green-600 dark:text-green-400">Published</span>
            )}
            {unmetPerms.length > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-yellow-600 dark:text-yellow-400">
                <ShieldAlert className="h-3 w-3" />
                Needs {unmetPerms.map((p) => PERMISSION_LABELS[p]).join(', ')}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {agent && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePublishToggle}
            disabled={publishing}
            title={isPublished ? 'Unpublish from network' : 'Publish to network'}
          >
            {isPublished
              ? <Globe className="h-4 w-4 text-green-500" />
              : <GlobeLock className="h-4 w-4 text-muted-foreground" />
            }
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={handleTest} title="Test Flow">
          <Play className="h-4 w-4 text-green-500" />
        </Button>
        <Switch checked={flow.enabled} onCheckedChange={handleToggle} />
        <Button variant="ghost" size="icon" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete your flow named &quot;{flow.name}&quot;.
              </AlertDialogDescription>
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

export function FlowList() {
  const flows = useAppStore((state) => state.flows);
  const addFlow = useAppStore((state) => state.addFlow);
  const updateFlow = useAppStore((state) => state.updateFlow);
  const permissions = usePermissions();

  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);

  const handleSaveNewFlow = (flow: Omit<Flow, 'id'>) => {
    addFlow(flow);
    setIsCreating(false);
  };

  const handleSaveEditedFlow = (flowData: Omit<Flow, 'id'>) => {
    if (editingFlowId && editingFlow) {
      updateFlow({ ...editingFlow, ...flowData, id: editingFlowId });
      setEditingFlowId(null);
    }
  };

  const editingFlow = flows.find(f => f.id === editingFlowId);

  if (isCreating) {
    return (
      <FlowForm onSave={handleSaveNewFlow} onCancel={() => setIsCreating(false)} />
    )
  }

  if (editingFlow) {
    return (
      <FlowForm
        flow={editingFlow}
        onSave={handleSaveEditedFlow}
        onCancel={() => setEditingFlowId(null)}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Flows</h2>
        <p className="text-muted-foreground">Create and manage your automations.</p>
      </div>

      {flows.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center text-center p-10 space-y-4">
            <div className="rounded-full bg-muted p-4">
              <Zap className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">No automations yet</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Flows connect device events like battery level or network changes to actions like webhooks and notifications.
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate('/discover')}>
              Browse Starter Templates
            </Button>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="divide-y">
            {flows.map((flow) => (
              <FlowListItem
                key={flow.id}
                flow={flow}
                onEdit={() => setEditingFlowId(flow.id)}
                permissions={permissions}
              />
            ))}
          </div>
        </Card>
      )}

      <Button
        onClick={() => setIsCreating(true)}
        size="icon"
        className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg z-40"
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
}
