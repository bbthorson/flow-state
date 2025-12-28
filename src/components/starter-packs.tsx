'use client';

import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { STARTER_FLOWS, FlowTemplate } from '@/lib/templates';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Battery, Wifi, Link, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

function StarterFlowCard({ template }: { template: FlowTemplate }) {
  const addFlowFromTemplate = useAppStore((state) => state.addFlowFromTemplate);
  const { toast } = useToast();

  const handleInstall = () => {
    addFlowFromTemplate(template);
    toast({
      title: "Flow Installed",
      description: `"${template.name}" has been added to your flows.`,
    });
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

export function StarterPacks() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Starter Packs</h2>
        <p className="text-sm text-muted-foreground">
          One-tap templates to get you started quickly.
        </p>
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        {STARTER_FLOWS.map((template) => (
          <StarterFlowCard key={template.name} template={template} />
        ))}
      </div>
    </div>
  );
}
