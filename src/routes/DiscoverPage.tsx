import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuthStore } from '@/store/useAuthStore';
import { useAppStore } from '@/store/useAppStore';
import { usePermissions } from '@/hooks/usePermissions';
import { STARTER_FLOWS } from '@/lib/templates';
import { RecipeCard } from '@/components/recipe-card';
import { RecipeInstallDialog } from '@/components/recipe-install-dialog';
import { EmptyState } from '@/components/empty-state';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import type { FlowRecipe } from '@/types';
import type { PublishedFlow } from '@/services/atproto';
import {
  ArrowLeft,
  Search,
  Users,
  Loader2,
  RefreshCw,
  Sparkles,
  BookOpen,
  X,
  Compass,
} from 'lucide-react';

type RecipeSource = 'all' | 'starters' | 'network';

export function DiscoverPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const permissions = usePermissions();

  const agent = useAuthStore((s) => s.agent);
  const networkFlows = useAuthStore((s) => s.networkFlows);
  const discovering = useAuthStore((s) => s.discovering);
  const discoverFromFollows = useAuthStore((s) => s.discoverFromFollows);
  const addFlowFromTemplate = useAppStore((s) => s.addFlowFromTemplate);
  const installFromNetwork = useAuthStore((s) => s.installFromNetwork);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<RecipeSource>('all');
  const [activeInstallRecipe, setActiveInstallRecipe] = useState<FlowRecipe | PublishedFlow | null>(null);

  // Automatically discover flows when signed in if not already fetched
  useEffect(() => {
    if (!agent) return;
    const { networkFlows: flows, discovering: inFlight } = useAuthStore.getState();
    if (flows.length === 0 && !inFlight) {
      discoverFromFollows();
    }
  }, [agent, discoverFromFollows]);

  // Combine and format all available recipes
  const allRecipes = useMemo(() => {
    const starters: Array<FlowRecipe & { source: 'starter' }> = STARTER_FLOWS.map((f) => ({
      ...f,
      source: 'starter',
      authorDid: 'Flow State Starter',
    }));

    const network: Array<PublishedFlow & { source: 'network' }> = networkFlows.map((f) => ({
      ...f,
      source: 'network',
      authorDid: f.did,
    }));

    return { starters, network, combined: [...starters, ...network] };
  }, [networkFlows]);

  // Collect all unique tags across recipes
  const availableTags = useMemo(() => {
    const tagsSet = new Set<string>();
    for (const r of allRecipes.combined) {
      r.tags?.forEach((t) => tagsSet.add(t));
    }
    return Array.from(tagsSet).sort();
  }, [allRecipes.combined]);

  // Filter recipes based on source, search query, and selected tag
  const filteredRecipes = useMemo(() => {
    let list: Array<FlowRecipe | PublishedFlow> = [];

    if (sourceFilter === 'starters') {
      list = allRecipes.starters;
    } else if (sourceFilter === 'network') {
      list = allRecipes.network;
    } else {
      list = allRecipes.combined;
    }

    const q = searchQuery.trim().toLowerCase();

    return list.filter((r) => {
      // Tag filter
      if (selectedTag && !r.tags?.includes(selectedTag)) {
        return false;
      }

      // Search query filter
      if (!q) return true;

      const nameMatch = r.name.toLowerCase().includes(q);
      const descMatch = (r.description ?? '').toLowerCase().includes(q);
      const tagMatch = r.tags?.some((t) => t.toLowerCase().includes(q));
      const triggerMatch = r.trigger.type.toLowerCase().includes(q);
      const actionMatch = r.actions.some((a) => a.type.toLowerCase().includes(q));
      const authorMatch = 'did' in r ? r.did.toLowerCase().includes(q) : false;

      return nameMatch || descMatch || tagMatch || triggerMatch || actionMatch || authorMatch;
    });
  }, [allRecipes, sourceFilter, searchQuery, selectedTag]);

  const handleSelectInstall = async (recipe: FlowRecipe | PublishedFlow) => {
    // If recipe requires parameters or has secrets, open the config dialog
    if (recipe.parameters && recipe.parameters.length > 0) {
      setActiveInstallRecipe(recipe);
      return;
    }

    // Zero-parameter recipe: install directly
    addFlowFromTemplate({
      name: recipe.name,
      description: recipe.description,
      tags: recipe.tags,
      enabled: false,
      trigger: recipe.trigger,
      actions: recipe.actions,
    });

    if ('uri' in recipe && recipe.uri) {
      await installFromNetwork(recipe as PublishedFlow);
    }

    toast({
      title: 'Recipe Installed',
      description: `"${recipe.name}" has been added to your flows.`,
    });
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-10">
      {/* Top Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/" aria-label="Back to timeline">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">Recipe Discovery</h2>
            <Badge variant="secondary" className="text-[10px] uppercase font-semibold">
              Social IFTTT
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Explore, fork, and install federated automation recipes.
          </p>
        </div>
      </div>

      {/* Search & Source Filter Tabs */}
      <div className="space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search recipes by name, tag (#battery), or action..."
            className="pl-9 pr-9 text-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Source Navigation Tabs */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
          <div className="flex items-center gap-1.5">
            <Button
              variant={sourceFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-8"
              onClick={() => setSourceFilter('all')}
            >
              <Compass className="mr-1.5 h-3.5 w-3.5" />
              All Recipes
              <span className="ml-1.5 rounded-full bg-muted/60 px-1.5 py-0.2 text-[10px]">
                {allRecipes.combined.length}
              </span>
            </Button>
            <Button
              variant={sourceFilter === 'starters' ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-8"
              onClick={() => setSourceFilter('starters')}
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" />
              Starter Packs
              <span className="ml-1.5 rounded-full bg-muted/60 px-1.5 py-0.2 text-[10px]">
                {allRecipes.starters.length}
              </span>
            </Button>
            <Button
              variant={sourceFilter === 'network' ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-8"
              onClick={() => setSourceFilter('network')}
            >
              <Users className="mr-1.5 h-3.5 w-3.5 text-sky-500" />
              Your Network
              {allRecipes.network.length > 0 && (
                <span className="ml-1.5 rounded-full bg-muted/60 px-1.5 py-0.2 text-[10px]">
                  {allRecipes.network.length}
                </span>
              )}
            </Button>
          </div>

          {/* Network Refresh Button (when signed in) */}
          {agent && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-8 shrink-0"
              onClick={discoverFromFollows}
              disabled={discovering}
            >
              <RefreshCw className={`mr-1.5 h-3 w-3 ${discovering ? 'animate-spin' : ''}`} />
              Sync Network
            </Button>
          )}
        </div>

        {/* Category Tag Pills */}
        {availableTags.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] text-muted-foreground uppercase font-semibold shrink-0">
              Tags:
            </span>
            <button
              type="button"
              onClick={() => setSelectedTag(null)}
              className="shrink-0"
            >
              <Badge
                variant={selectedTag === null ? 'default' : 'secondary'}
                className="cursor-pointer text-[10px] h-6 px-2"
              >
                All Tags
              </Badge>
            </button>
            {availableTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className="shrink-0"
              >
                <Badge
                  variant={selectedTag === tag ? 'default' : 'secondary'}
                  className="cursor-pointer text-[10px] h-6 px-2 hover:bg-secondary/80"
                >
                  #{tag}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Recipe Content */}
      {sourceFilter === 'network' && !agent ? (
        <Card>
          <EmptyState
            icon={Users}
            size="lg"
            title="Connect your identity"
            description="Sign in with your Bluesky handle to discover automated recipes published by creators and friends you follow."
            action={
              <Button variant="outline" onClick={() => navigate('/?panel=control')}>
                Sign in with Bluesky
              </Button>
            }
          />
        </Card>
      ) : discovering ? (
        <div className="flex flex-col items-center justify-center p-12 text-sm text-muted-foreground space-y-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p>Crawling your social graph for published recipes...</p>
        </div>
      ) : filteredRecipes.length === 0 ? (
        <Card>
          <EmptyState
            icon={Search}
            size="sm"
            title="No recipes found"
            description={
              searchQuery || selectedTag
                ? 'Try clearing your search query or tag filters to see more recipes.'
                : 'No recipes match this category yet.'
            }
            action={
              (searchQuery || selectedTag) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedTag(null);
                  }}
                >
                  Reset filters
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          {filteredRecipes.map((recipe) => (
            <RecipeCard
              key={'uri' in recipe ? recipe.uri : recipe.name}
              recipe={recipe}
              permissions={permissions}
              onSelectInstall={handleSelectInstall}
              onTagClick={(tag) => setSelectedTag(tag)}
            />
          ))}
        </div>
      )}

      {/* Learn More Footer */}
      <div className="text-center pt-4 border-t">
        <Link
          to="/docs/flows"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <BookOpen className="h-3.5 w-3.5" />
          Learn how federated flow state recipes work
        </Link>
      </div>

      {/* Configuration & Install Modal */}
      <RecipeInstallDialog
        recipe={activeInstallRecipe}
        open={Boolean(activeInstallRecipe)}
        onOpenChange={(open) => {
          if (!open) setActiveInstallRecipe(null);
        }}
      />
    </div>
  );
}
