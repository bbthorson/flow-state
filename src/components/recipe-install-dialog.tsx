import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';
import { instantiateRecipe } from '@/lib/recipe';
import type { FlowRecipe, FlowScope, FlowParameterDefinition } from '@/types';
import type { PublishedFlow } from '@/services/atproto';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Lock, Sparkles, SlidersHorizontal, Check } from 'lucide-react';

interface RecipeInstallDialogProps {
  recipe: FlowRecipe | PublishedFlow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function RecipeInstallDialog({
  recipe,
  open,
  onOpenChange,
  onSuccess,
}: RecipeInstallDialogProps) {
  const addFlow = useAppStore((s) => s.addFlow);
  const installFromNetwork = useAuthStore((s) => s.installFromNetwork);
  const { toast } = useToast();

  const [flowName, setFlowName] = useState(recipe?.name ?? '');
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [secretValues, setSecretValues] = useState<Record<string, string>>({});
  const [scope, setScope] = useState<FlowScope>('local');
  const [spaceId, setSpaceId] = useState('');

  if (!recipe) return null;

  const parameters: FlowParameterDefinition[] = recipe.parameters ?? [];
  const secretParams = parameters.filter((p) => p.type === 'secret');
  const regularParams = parameters.filter((p) => p.type !== 'secret');

  const handleInstall = async () => {
    // Validate required parameters
    for (const param of parameters) {
      if (param.required) {
        const val = param.type === 'secret' ? secretValues[param.key] : paramValues[param.key];
        if (!val || val.trim() === '') {
          toast({
            title: 'Missing Required Field',
            description: `Please provide a value for "${param.label}".`,
            variant: 'destructive',
          });
          return;
        }
      }
    }

    const flowToInstall = instantiateRecipe(recipe as FlowRecipe, {
      name: flowName.trim() || recipe.name,
      values: paramValues,
      secrets: secretValues,
      scope,
      spaceId: scope === 'space' && spaceId.trim() ? spaceId.trim() : undefined,
      enabled: false,
    });

    addFlow(flowToInstall);

    // If this is a published flow from ATProto, track install record on user's PDS
    if ('uri' in recipe && recipe.uri) {
      await installFromNetwork(recipe as PublishedFlow);
    }

    toast({
      title: 'Recipe Installed',
      description: `"${flowToInstall.name}" is now ready in your flows list.`,
    });

    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-[10px] tracking-wider uppercase font-semibold">
              {recipe.trigger.type.replace(/_/g, ' ')}
            </Badge>
            {recipe.tags?.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px]">
                #{tag}
              </Badge>
            ))}
          </div>
          <DialogTitle className="text-xl">{recipe.name}</DialogTitle>
          <DialogDescription className="text-sm">
            {recipe.description || 'Configure parameters to install this automation on your device.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Custom Name */}
          <div className="space-y-1.5">
            <Label htmlFor="flow-name" className="text-xs font-semibold">Flow Name</Label>
            <Input
              id="flow-name"
              value={flowName || recipe.name}
              onChange={(e) => setFlowName(e.target.value)}
              placeholder="Name this flow..."
            />
          </div>

          {/* Regular Parameters */}
          {regularParams.length > 0 && (
            <div className="space-y-3 pt-1 border-t">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                Parameters
              </div>
              {regularParams.map((param) => (
                <div key={param.key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`param-${param.key}`} className="text-xs font-medium">
                      {param.label}
                      {param.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                  </div>
                  {param.description && (
                    <p className="text-[11px] text-muted-foreground">{param.description}</p>
                  )}
                  <Input
                    id={`param-${param.key}`}
                    value={paramValues[param.key] ?? ''}
                    onChange={(e) =>
                      setParamValues((prev) => ({ ...prev, [param.key]: e.target.value }))
                    }
                    placeholder={`Enter ${param.label.toLowerCase()}...`}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Secret Parameters */}
          {secretParams.length > 0 && (
            <div className="space-y-3 pt-1 border-t">
              <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                <span className="flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-amber-500" />
                  Secrets & Credentials
                </span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  Kept private on device
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                These secrets will be stored in your local vault or private space and will never be shared publicly.
              </p>
              {secretParams.map((param) => (
                <div key={param.key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`secret-${param.key}`} className="text-xs font-medium">
                      {param.label}
                      {param.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                  </div>
                  {param.description && (
                    <p className="text-[11px] text-muted-foreground">{param.description}</p>
                  )}
                  <Input
                    id={`secret-${param.key}`}
                    type="password"
                    value={secretValues[param.key] ?? ''}
                    onChange={(e) =>
                      setSecretValues((prev) => ({ ...prev, [param.key]: e.target.value }))
                    }
                    placeholder={`Enter ${param.label.toLowerCase()}...`}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Execution Scope (Local vs ATProto Spaces) */}
          <div className="space-y-2 pt-1 border-t">
            <Label className="text-xs font-semibold">Storage & Execution Scope</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={scope === 'local' ? 'default' : 'outline'}
                size="sm"
                className="justify-start text-xs h-9"
                onClick={() => setScope('local')}
              >
                {scope === 'local' && <Check className="mr-1.5 h-3.5 w-3.5" />}
                Local (On-Device)
              </Button>
              <Button
                type="button"
                variant={scope === 'space' ? 'default' : 'outline'}
                size="sm"
                className="justify-start text-xs h-9"
                onClick={() => setScope('space')}
              >
                {scope === 'space' && <Check className="mr-1.5 h-3.5 w-3.5" />}
                <Sparkles className="mr-1 h-3.5 w-3.5 text-amber-500" />
                ATProto Space
              </Button>
            </div>
            {scope === 'space' && (
              <div className="space-y-1 pt-1">
                <Label htmlFor="space-id" className="text-[11px] text-muted-foreground">
                  Space Authority DID or Key
                </Label>
                <Input
                  id="space-id"
                  value={spaceId}
                  onChange={(e) => setSpaceId(e.target.value)}
                  placeholder="did:plc:... or space key"
                  className="text-xs"
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleInstall}>
            Install Flow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
