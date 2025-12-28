'use client';

import React from 'react';
import { TriggerType } from '@/types';
import { Badge } from '@/components/ui/badge';
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

const HINTS: Record<TriggerType, string[]> = {
  NATIVE_BATTERY: ['level', 'charging'],
  NETWORK: ['online', 'type', 'ssid'],
  GEOLOCATION: ['event', 'latitude', 'longitude', 'distance'],
  DEEP_LINK: ['any custom key passed in URL/payload'],
  MANUAL: [],
};

export function VariableHints({ type }: VariableHintsProps) {
  const variables = HINTS[type];

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
              <p className="text-xs">Use these in your actions with {"{{variable_name}}"} syntax.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="flex flex-wrap gap-1">
        {type === 'DEEP_LINK' ? (
          <span className="text-[10px] text-muted-foreground italic">
            Any keys from query params or JSON payload
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
