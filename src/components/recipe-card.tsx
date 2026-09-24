import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { triggerIcon } from '@/lib/flow-constants';
import { getFlowPermissions, DevicePermission, PermissionState } from '@/lib/permissions';
import { PermissionHint } from '@/components/permission-hint';
import type { FlowRecipe } from '@/types';
import type { PublishedFlow } from '@/services/atproto';
import { Plus, Sliders, Globe, Lock, GitFork, User } from 'lucide-react';

interface RecipeCardProps {
  recipe: FlowRecipe | PublishedFlow;
  permissions?: Record<DevicePermission, PermissionState>;
  onSelectInstall: (recipe: FlowRecipe | PublishedFlow) => void;
  onTagClick?: (tag: string) => void;
}

function actionPreview(action: { type: string; details: Record<string, any> }): string {
  const d = action.details;
  return d?.title || d?.url || d?.text || d?.message || action.type;
}

export function RecipeCard({
  recipe,
  permissions,
  onSelectInstall,
  onTagClick,
}: RecipeCardProps) {
  const Icon = triggerIcon(recipe.trigger.type);
  const parameters = recipe.parameters ?? [];
  const hasSecrets = parameters.some((p) => p.type === 'secret');
  const hasParams = parameters.length > 0;

  // Check required permissions if permission map provided
  const requiredPerms = permissions ? getFlowPermissions(recipe) : [];
  const unmetPerms = permissions
    ? requiredPerms.filter((p) => permissions[p] !== 'granted')
    : [];
  const permissionsSatisfied = unmetPerms.length === 0;

  const isNetworkFlow = 'did' in recipe;
  const authorDisplay = isNetworkFlow
    ? (recipe as PublishedFlow).did.startsWith('did:plc:')
      ? `${(recipe as PublishedFlow).did.slice(0, 16)}…`
      : (recipe as PublishedFlow).did
    : 'Curated Starter Pack';

  return (
    <Card className="flex flex-col h-full justify-between hover:border-primary/50 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
            <Icon className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] uppercase tracking-wider">
              {recipe.trigger.type.replace(/_/g, ' ')}
            </span>
          </div>
          {recipe.forkedFromUri && (
            <Badge variant="outline" className="text-[10px] gap-1 h-5 text-muted-foreground">
              <GitFork className="h-2.5 w-2.5" />
              Fork
            </Badge>
          )}
        </div>

        <CardTitle className="text-base line-clamp-1">{recipe.name}</CardTitle>

        <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem] mt-1">
          {recipe.description || 'Pre-built automation recipe.'}
        </p>

        {/* Tags */}
        {recipe.tags && recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {recipe.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onTagClick?.(tag)}
                className="inline-flex"
              >
                <Badge
                  variant="secondary"
                  className="text-[10px] py-0 px-1.5 h-4 hover:bg-secondary/80 cursor-pointer"
                >
                  #{tag}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="py-2 flex-grow space-y-3">
        {/* Actions Summary */}
        <div className="space-y-1.5 rounded-md bg-muted/40 p-2 text-xs">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
            {recipe.actions.length} {recipe.actions.length === 1 ? 'Action' : 'Actions'}
          </div>
          {recipe.actions.slice(0, 2).map((action, i) => (
            <div key={i} className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
              <span className="font-semibold text-foreground/80">{action.type}:</span>
              <span className="truncate">{actionPreview(action)}</span>
            </div>
          ))}
          {recipe.actions.length > 2 && (
            <div className="text-[10px] text-muted-foreground italic">
              +{recipe.actions.length - 2} more
            </div>
          )}
        </div>

        {/* Author / Source Badge */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
          <span className="flex items-center gap-1 truncate max-w-[180px]">
            {isNetworkFlow ? <Globe className="h-3 w-3 shrink-0" /> : <User className="h-3 w-3 shrink-0" />}
            <span className="truncate">{authorDisplay}</span>
          </span>
          {hasSecrets && (
            <Badge variant="outline" className="text-[9px] gap-1 h-4 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800">
              <Lock className="h-2 w-2" />
              Credentials
            </Badge>
          )}
        </div>

        {/* Permission warnings if any */}
        {unmetPerms.length > 0 && (
          <div className="space-y-1 pt-1">
            {unmetPerms.map((perm) => (
              <PermissionHint
                key={perm}
                permission={perm}
                state={permissions![perm]}
                onRequest={() => {}}
              />
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-2">
        <Button
          onClick={() => onSelectInstall(recipe)}
          variant={hasParams ? 'outline' : 'secondary'}
          size="sm"
          className="w-full text-xs"
          disabled={!permissionsSatisfied}
        >
          {hasParams ? (
            <>
              <Sliders className="mr-1.5 h-3 w-3" />
              Configure & Install
            </>
          ) : (
            <>
              <Plus className="mr-1.5 h-3 w-3" />
              Install
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
