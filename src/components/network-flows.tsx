import { useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useAppStore } from '@/store/useAppStore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Globe, Users, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PublishedFlow } from '@/services/atproto';
import { useNavigate } from 'react-router';
import { FlowCard } from '@/components/flow-card';
import { EmptyState } from '@/components/empty-state';

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
    <FlowCard
      icon={Globe}
      triggerType={flow.trigger.type}
      title={flow.name}
      subtitle={`by ${flow.did.slice(0, 20)}...`}
      actions={flow.actions}
      footer={
        <Button onClick={handleInstall} variant="secondary" size="sm" className="w-full">
          <Plus className="mr-2 h-3 w-3" />
          Install
        </Button>
      }
    />
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
          <EmptyState
            icon={Users}
            size="lg"
            title="Connect your identity"
            description="Sign in with your Bluesky account to discover flows published by people you follow."
            action={
              <Button variant="outline" onClick={() => navigate('/?panel=control')}>
                Sign in with Bluesky
              </Button>
            }
          />
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
