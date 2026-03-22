import { useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useAppStore } from '@/store/useAppStore';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Globe, Users, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PublishedFlow } from '@/services/atproto';
import { useNavigate } from 'react-router';

function NetworkFlowCard({ flow }: { flow: PublishedFlow }) {
  const addFlowFromTemplate = useAppStore((s) => s.addFlowFromTemplate);
  const installFromNetwork = useAuthStore((s) => s.installFromNetwork);
  const { toast } = useToast();

  const handleInstall = async () => {
    addFlowFromTemplate({
      name: flow.name,
      enabled: false,
      trigger: flow.trigger,
      actions: flow.actions,
    });
    await installFromNetwork(flow);
    toast({
      title: 'Flow Installed',
      description: `"${flow.name}" has been added to your flows.`,
    });
  };

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center gap-2 mb-1">
          <Globe className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {flow.trigger.type.replace(/_/g, ' ')}
          </span>
        </div>
        <CardTitle className="text-lg">{flow.name}</CardTitle>
        <CardDescription className="text-xs">
          by {flow.did.slice(0, 20)}...
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="space-y-2">
          {flow.actions.map((action, i) => (
            <div key={i} className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="font-semibold text-primary/80">{action.type}:</span>
              <span className="truncate">{action.details.title || action.details.url || action.details.text || 'Execution'}</span>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleInstall} variant="secondary" size="sm" className="w-full">
          <Plus className="mr-2 h-3 w-3" />
          Install
        </Button>
      </CardFooter>
    </Card>
  );
}

export function NetworkFlows() {
  const agent = useAuthStore((s) => s.agent);
  const networkFlows = useAuthStore((s) => s.networkFlows);
  const discovering = useAuthStore((s) => s.discovering);
  const discoverFromFollows = useAuthStore((s) => s.discoverFromFollows);
  const navigate = useNavigate();

  useEffect(() => {
    if (agent && networkFlows.length === 0 && !discovering) {
      discoverFromFollows();
    }
  }, [agent]);

  if (!agent) {
    return (
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">From Your Network</h3>
        <Card>
          <div className="flex flex-col items-center text-center p-10 space-y-4">
            <div className="rounded-full bg-muted p-4">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Connect your identity</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Sign in with your Bluesky account to discover flows published by people you follow.
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate('/settings')}>
              Sign in with Bluesky
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">From Your Network</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={discoverFromFollows}
          disabled={discovering}
        >
          {discovering ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Refresh'}
        </Button>
      </div>
      {discovering ? (
        <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Checking your follows for published flows...
        </div>
      ) : networkFlows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          No flows found from people you follow yet. As people publish flows, they'll appear here.
        </p>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          {networkFlows.map((flow) => (
            <NetworkFlowCard key={flow.uri} flow={flow} />
          ))}
        </div>
      )}
    </div>
  );
}
