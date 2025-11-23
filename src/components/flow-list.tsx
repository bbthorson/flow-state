'use client';

import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Flow } from '@/store/useAppStore';
import { Link, Trash2, Pencil, PlusCircle } from 'lucide-react';

// This would be in its own file, e.g., components/flow-form.tsx
function FlowForm({ flow, onSave, onCancel }: { flow?: Flow, onSave: (flow: Omit<Flow, 'id'>) => void, onCancel: () => void }) {
    // For now, this is a placeholder. A real implementation would use a form library.
    const handleSave = () => {
        const newFlow: Omit<Flow, 'id'> = {
            name: 'New Sample Flow',
            enabled: true,
            trigger: {
                type: 'DEEP_LINK',
                details: { 'event': 'sample' }
            },
            actions: [{
                type: 'LOG',
                details: {}
            }]
        };
        onSave(newFlow);
    }
    return (
        <div className="p-4 border rounded-lg">
            <h3 className="text-lg font-bold mb-4">{flow ? 'Edit Flow' : 'Create Flow'}</h3>
            <p className="text-sm text-muted-foreground mb-4">
                Flow creation form will be here. For now, saving will create a sample flow.
            </p>
            <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                <Button onClick={handleSave}>Save</Button>
            </div>
        </div>
    );
}

function FlowListItem({ flow }: { flow: Flow }) {
  const { updateFlow, deleteFlow } = useAppStore();

  const handleToggle = (enabled: boolean) => {
    updateFlow({ ...flow, enabled });
  };

  const handleDelete = () => {
    deleteFlow(flow.id);
  };

  return (
    <div className="flex items-center justify-between p-3 border-b">
      <div className="flex items-center gap-4">
        <Link className="h-5 w-5 text-muted-foreground" />
        <span className="font-medium">{flow.name}</span>
      </div>
      <div className="flex items-center gap-4">
        <Switch checked={flow.enabled} onCheckedChange={handleToggle} />
        <Button variant="ghost" size="icon" disabled>
            <Pencil className="h-4 w-4" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete your flow named &quot;{flow.name}&quot;.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

export function FlowList() {
  const flows = useAppStore((state) => state.flows);
  const addFlow = useAppStore((state) => state.addFlow);
  const [isCreating, setIsCreating] = useState(false);

  const handleSaveNewFlow = (flow: Omit<Flow, 'id'>) => {
    addFlow(flow);
    setIsCreating(false);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
            <div>
                <CardTitle>Flows</CardTitle>
                <CardDescription>Create and manage your automations.</CardDescription>
            </div>
            {!isCreating && (
                <Button onClick={() => setIsCreating(true)}>
                    <PlusCircle className="mr-2 h-4 w-4"/>
                    Create Flow
                </Button>
            )}
        </div>
      </CardHeader>
      <CardContent>
        {isCreating ? (
            <FlowForm onSave={handleSaveNewFlow} onCancel={() => setIsCreating(false)} />
        ) : (
            <div className="border rounded-md">
                {flows.length === 0 ? (
                <div className="text-center text-muted-foreground p-8">
                    <p>You have no flows yet.</p>
                    <p>Click &quot;Create Flow&quot; to get started.</p>
                </div>
                ) : (
                flows.map((flow) => <FlowListItem key={flow.id} flow={flow} />)
                )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
