'use client';

import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { FlowForm } from '@/components/flow-form';

function FlowListItem({ flow, onEdit }: { flow: Flow, onEdit: () => void }) {
  const { updateFlow, deleteFlow } = useAppStore();

  const handleToggle = (enabled: boolean) => {
    updateFlow({ ...flow, enabled });
  };

  const handleDelete = () => {
    deleteFlow(flow.id);
  };

  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex items-center gap-4">
        <Link className="h-5 w-5 text-muted-foreground" />
        <span className="font-medium">{flow.name}</span>
      </div>
      <div className="flex items-center gap-4">
        <Switch checked={flow.enabled} onCheckedChange={handleToggle} />
        <Button variant="ghost" size="icon" onClick={onEdit}>
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
  const updateFlow = useAppStore((state) => state.updateFlow);

  const [isCreating, setIsCreating] = useState(false);
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);

  const handleSaveNewFlow = (flow: Omit<Flow, 'id'>) => {
    addFlow(flow);
    setIsCreating(false);
  };

  const handleSaveEditedFlow = (flowData: Omit<Flow, 'id'>) => {
      if (editingFlowId) {
          updateFlow({ ...flowData, id: editingFlowId });
          setEditingFlowId(null);
      }
  };

  const editingFlow = flows.find(f => f.id === editingFlowId);

  if (isCreating) {
      return (
        <div className="space-y-4">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Create New Flow</h2>
            </div>
            <Card>
                <CardContent className="p-6">
                    <FlowForm onSave={handleSaveNewFlow} onCancel={() => setIsCreating(false)} />
                </CardContent>
            </Card>
        </div>
      )
  }

  if (editingFlow) {
      return (
        <div className="space-y-4">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Edit Flow</h2>
            </div>
            <Card>
                <CardContent className="p-6">
                    <FlowForm
                        flow={editingFlow}
                        onSave={handleSaveEditedFlow}
                        onCancel={() => setEditingFlowId(null)}
                    />
                </CardContent>
            </Card>
        </div>
      )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
            <h2 className="text-2xl font-bold tracking-tight">Flows</h2>
            <p className="text-muted-foreground">Create and manage your automations.</p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
            <PlusCircle className="mr-2 h-4 w-4"/>
            Create Flow
        </Button>
      </div>

      <Card>
        <div className="divide-y">
            {flows.length === 0 ? (
            <div className="text-center text-muted-foreground p-8">
                <p>You have no flows yet.</p>
                <p>Click &quot;Create Flow&quot; to get started.</p>
            </div>
            ) : (
            flows.map((flow) => (
                <FlowListItem
                    key={flow.id}
                    flow={flow}
                    onEdit={() => setEditingFlowId(flow.id)}
                />
            ))
            )}
        </div>
      </Card>
    </div>
  );
}
