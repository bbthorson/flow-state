import { useAppStore } from '@/store/useAppStore';
import { STARTER_FLOWS, FlowTemplate } from '@/lib/templates';
import { Button } from '@/components/ui/button';
import { Plus, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { getFlowPermissions, PERMISSION_LABELS, requestPermission, DevicePermission, PermissionState } from '@/lib/permissions';
import { triggerIcon } from '@/lib/flow-constants';
import { FlowCard } from '@/components/flow-card';
import { PermissionHint } from '@/components/permission-hint';

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
      title: 'Flow Installed',
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
    <FlowCard
      icon={triggerIcon(template.trigger.type)}
      triggerType={template.trigger.type}
      title={template.name}
      subtitle={`${template.actions.length} ${template.actions.length === 1 ? 'Action' : 'Actions'}`}
      actions={template.actions}
      footer={
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
      }
    >
      {unmetPerms.length > 0 && (
        <div className="mt-3 flex flex-col gap-1">
          <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
            <ShieldAlert className="h-3 w-3" />
            Requires:
          </div>
          {unmetPerms.map((perm) => (
            <PermissionHint
              key={perm}
              permission={perm}
              state={permissions[perm]}
              onRequest={handleRequestPermission}
            />
          ))}
        </div>
      )}
    </FlowCard>
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
