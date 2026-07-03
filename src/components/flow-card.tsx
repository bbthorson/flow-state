import { type LucideIcon } from 'lucide-react';
import { ActionType } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

type ActionSummary = { type: ActionType | string; details: Record<string, any> };

function actionPreview(details: Record<string, any>): string {
  return details.title || details.url || details.text || details.message || 'Execution';
}

/**
 * Presentational card for a flow shown in a discovery list. Unifies the
 * near-identical starter-pack and network-flow cards; callers supply the icon,
 * subtitle, footer action, and any extra content (e.g. permission hints).
 */
export function FlowCard({
  icon: Icon,
  triggerType,
  title,
  subtitle,
  actions,
  footer,
  children,
}: {
  icon: LucideIcon;
  triggerType: string;
  title: string;
  subtitle: string;
  actions: ActionSummary[];
  footer: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="mb-1 flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {triggerType.replace(/_/g, ' ')}
          </span>
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription className="text-xs">{subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="space-y-2">
          {actions.map((action, i) => (
            <div key={i} className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="font-semibold text-primary/80">{action.type}:</span>
              <span className="truncate">{actionPreview(action.details)}</span>
            </div>
          ))}
        </div>
        {children}
      </CardContent>
      <CardFooter>{footer}</CardFooter>
    </Card>
  );
}
