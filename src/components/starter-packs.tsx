import { useAppStore } from '@/store/useAppStore';
import { STARTER_FLOWS, FlowTemplate } from '@/lib/templates';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Battery, Wifi, Link, Zap, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { getFlowPermissions, PERMISSION_LABELS, requestPermission, DevicePermission, PermissionState } from '@/lib/permissions';

function TemplateIcon({ type }: { type: string }) {
  switch (type) {
    case 'NATIVE_BATTERY':
      return <Battery className="h-4 w-4" />;
    case 'NETWORK':
      return <Wifi className="h-4 w-4" />;
    case 'DEEP_LINK':
      return <Link className="h-4 w-4" />;
    default:
      return <Zap className="h-4 w-4" />;
  }
}

function PermissionBadge({ permission, state, onRequest }: {
  permission: DevicePermission;
  state: PermissionState;
  onRequest: () => void;
}) {
  if (state === 'granted') return null;

  const label = PERMISSION_LABELS[permission];

  if (state === 'unavailable') {
    return (
      <span className="text-[10px] text-destructive">
        {label} not supported
      </span>
    );
  }

  if (state === 'denied') {
    return (
      <span className="text-[10px] text-destructive">
        {label} denied — enable in browser settings
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onRequest}
      className="text-[10px] text-blue-500 hover:underline"
    >
      Grant {label}
    </button>
  );
}

function StarterFlowCard({ template, permissions }: {
  template: FlowTemplate;
  permissions: Record<DevicePermission, PermissionState>;
}) {
  const addFlowFromTemplate = useAppStore((state) => state.addFlowFromTemplate);
  const { toast } = useToast();

  const requiredPerms = getFlowPermissions(template);
  const unmetPerms = requiredPerms.filter((p) => permissions[p] !== 'granted');
  const canInstall = unmetPerms.length === 0;

  const handleInstall = () => {
    addFlowFromTemplate(template);
    toast({
      title: "Flow Installed",
      description: `"${template.name}" has been added to your flows.`,
    });
  };

  const handleRequestPermission = async (perm: DevicePermission) => {
    const result = await requestPermission(perm);
    if (result === 'granted') {
      toast({ title: 'Permission Granted', description: `${PERMISSION_LABELS[perm]} is now available.` });
    } else if (result === 'denied') {
      toast({ title: 'Permission Denied', description: `Enable ${PERMISSION_LABELS[perm]} in your browser settings.`, variant: 'destructive' });
    }
  };

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center gap-2 mb-1">
          <TemplateIcon type={template.trigger.type} />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {template.trigger.type.replace('_', ' ')}
          </span>
        </div>
        <CardTitle className="text-lg">{template.name}</CardTitle>
        <CardDescription className="text-xs">
          {template.actions.length} {template.actions.length === 1 ? 'Action' : 'Actions'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="space-y-2">
          {template.actions.map((action, i) => (
            <div key={i} className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="font-semibold text-primary/80">{action.type}:</span>
              <span className="truncate">{action.details.title || action.details.url || 'Execution'}</span>
            </div>
          ))}
        </div>
        {unmetPerms.length > 0 && (
          <div className="mt-3 flex flex-col gap-1">
            <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
              <ShieldAlert className="h-3 w-3" />
              Requires:
            </div>
            {unmetPerms.map((perm) => (
              <PermissionBadge
                key={perm}
                permission={perm}
                state={permissions[perm]}
                onRequest={() => handleRequestPermission(perm)}
              />
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button
          onClick={handleInstall}
          variant="secondary"
          size="sm"
          className="w-full"
          disabled={!canInstall}
        >
          <Plus className="mr-2 h-3 w-3" />
          {canInstall ? 'Install' : 'Permissions Required'}
        </Button>
      </CardFooter>
    </Card>
  );
}

export function StarterPacks() {
  const permissions = usePermissions();

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
      {STARTER_FLOWS.map((template) => (
        <StarterFlowCard key={template.name} template={template} permissions={permissions} />
      ))}
    </div>
  );
}
