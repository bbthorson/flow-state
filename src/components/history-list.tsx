'use client';

import { useAppStore } from '@/store/useAppStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card>
      <CardHeader>
        <CardTitle>History</CardTitle>
        <CardDescription>A log of all flow executions and system events.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md">
            {logs.length === 0 ? (
                <div className="text-center text-muted-foreground p-8">
                    <p>No events have been logged yet.</p>
                </div>
            ) : (
                <div className="flex flex-col-reverse">
                    {/* Reverse flex direction to show newest logs at the top */}
                    {logs.map((log) => (
                        <div key={log.id} className="flex items-start gap-4 p-3 border-b">
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
      </CardContent>
    </Card>
  );
}
