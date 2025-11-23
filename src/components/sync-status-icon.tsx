'use client';

import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
  } from "@/components/ui/tooltip"

const getStatus = (timestamp: number | null): { color: string; tooltip: string } => {
    if (timestamp === null) {
        return { color: 'bg-red-500', tooltip: 'No backup created yet. Create one from the settings menu.' };
    }

    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const fiveDays = 5 * 24 * 60 * 60 * 1000;
    const age = Date.now() - timestamp;

    if (age > sevenDays) {
        return { color: 'bg-red-500', tooltip: 'Your last backup is over 7 days old.' };
    }
    if (age > fiveDays) {
        return { color: 'bg-yellow-500', tooltip: 'Your last backup is over 5 days old.' };
    }
    return { color: 'bg-green-500', tooltip: 'Your data is recently backed up.' };
}

export function SyncStatusIcon() {
    const lastBackupTimestamp = useAppStore(state => state.lastBackupTimestamp);
    const { color, tooltip } = getStatus(lastBackupTimestamp);

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger>
                    <div className={cn("w-3 h-3 rounded-full", color)}></div>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{tooltip}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
