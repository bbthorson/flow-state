import React from 'react';
import { TriggerType } from '@/types';
import { Badge } from '@/components/ui/badge';
import { TRIGGER_DATA_KEYS } from '@/lib/flow-constants';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface VariableHintsProps {
  type: TriggerType;
}


export function VariableHints({ type }: VariableHintsProps) {
  const variables = TRIGGER_DATA_KEYS[type].map((k) => `trigger.${k}`);

  if (variables.length === 0 && type !== 'DEEP_LINK') return null;

  return (
    <div className="flex flex-col gap-2 p-3 bg-muted/30 rounded-md border border-dashed">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Info className="h-3 w-3" />
        <span>Available Variables</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-help">
                <Info className="h-3 w-3 opacity-50" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">
                Use in text and bodies as {"{{trigger.key}}"}. Also available: {"{{device.battery.level}}"},
                {" {{time.hour}}"}, and variables by name. Trigger data can't go in webhook URLs or headers.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="flex flex-wrap gap-1">
        {type === 'DEEP_LINK' ? (
          <span className="text-[10px] text-muted-foreground italic">
            Any keys from query params or JSON payload, as {'{{trigger.<key>}}'}
          </span>
        ) : (
          variables.map((v) => (
            <Badge key={v} variant="secondary" className="text-[10px] py-0 px-1 font-mono">
              {"{{"}{v}{"}}"}
            </Badge>
          ))
        )}
      </div>
    </div>
  );
}
