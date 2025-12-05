'use client';

import { useAppStore } from '@/store/useAppStore';
import { Card } from '@/components/ui/card';
import { CheckCircle2, XCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatTimeAgo(timestamp: number): string {
    const now = Date.now();
    const seconds = Math.floor((now - timestamp) / 1000);
  
    if (seconds < 2) {
        return `just now`;
    }
    if (seconds < 60) {
      return `${seconds} seconds ago`;
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
}

export function HistoryList() {
  const logs = useAppStore((state) => state.logs);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">History</h2>
        <p className="text-muted-foreground">A log of all flow executions and system events.</p>
      </div>

      <Card>
        <div className="divide-y">
            {logs.length === 0 ? (
                <div className="text-center text-muted-foreground p-8">
                    <p>No events have been logged yet.</p>
                </div>
            ) : (
                <div className="flex flex-col divide-y">
                    {logs.map((log) => (
                        <div key={log.id} className="flex items-start gap-4 p-4">
                            {log.status === 'success' && <CheckCircle2 className="h-5 w-5 text-green-500 mt-1" />}
                            {log.status === 'failure' && <XCircle className="h-5 w-5 text-red-500 mt-1" />}
                            {log.flowId === 'SYSTEM' && log.status !== 'success' && log.status !== 'failure' && <Info className="h-5 w-5 text-blue-500 mt-1" />}
                            
                            <div className="flex-grow">
                                <p className={cn("font-medium", {
                                    "text-red-500": log.status === 'failure',
                                })}>
                                    {log.message}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {formatTimeAgo(log.timestamp)}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </Card>
    </div>
  );
}
