import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { instantiateRecipe, recipeBlanks } from '@/lib/recipe';
import type { FlowRecipe, VariableStep } from '@/types';
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
import { Lock, SlidersHorizontal } from 'lucide-react';

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
  const { toast } = useToast();

  const [flowName, setFlowName] = useState(recipe?.name ?? '');
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [secretValues, setSecretValues] = useState<Record<string, string>>({});

  if (!recipe) return null;

  const parameters: VariableStep[] = recipeBlanks(recipe);
  const secretParams = parameters.filter((p) => p.kind === 'secret');
  const regularParams = parameters.filter((p) => p.kind !== 'secret');
  const labelOf = (p: VariableStep) => p.label ?? p.name;

  const handleInstall = async () => {
    // Validate required parameters
    for (const param of parameters) {
      if (param.required !== false) {
        const val = param.kind === 'secret' ? secretValues[param.name] : paramValues[param.name];
        if (!val || val.trim() === '') {
          toast({
            title: 'Missing Required Field',
            description: `Please provide a value for "${labelOf(param)}".`,
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
    });

    addFlow(flowToInstall);

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
                <div key={param.name} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`param-${param.name}`} className="text-xs font-medium">
                      {labelOf(param)}
                      {param.required !== false && <span className="text-destructive ml-1">*</span>}
                    </Label>
                  </div>
                  {param.note && (
                    <p className="text-[11px] text-muted-foreground">{param.note}</p>
                  )}
                  <Input
                    id={`param-${param.name}`}
                    value={paramValues[param.name] ?? ''}
                    onChange={(e) =>
                      setParamValues((prev) => ({ ...prev, [param.name]: e.target.value }))
                    }
                    placeholder={`Enter ${labelOf(param).toLowerCase()}...`}
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
                These are stored only on this device and are never written to any record, public or private.
              </p>
              {secretParams.map((param) => (
                <div key={param.name} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`secret-${param.name}`} className="text-xs font-medium">
                      {labelOf(param)}
                      {param.required !== false && <span className="text-destructive ml-1">*</span>}
                    </Label>
                  </div>
                  {param.note && (
                    <p className="text-[11px] text-muted-foreground">{param.note}</p>
                  )}
                  <Input
                    id={`secret-${param.name}`}
                    type="password"
                    value={secretValues[param.name] ?? ''}
                    onChange={(e) =>
                      setSecretValues((prev) => ({ ...prev, [param.name]: e.target.value }))
                    }
                    placeholder={`Enter ${labelOf(param).toLowerCase()}...`}
                  />
                </div>
              ))}
            </div>
          )}

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
