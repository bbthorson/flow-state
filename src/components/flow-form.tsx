'use client';

import { useState } from 'react';
import { useForm, useFieldArray, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Flow, TriggerType, ActionType } from '@/store/useAppStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2, PlusCircle } from 'lucide-react';

const triggerTypes: TriggerType[] = ['NATIVE_BATTERY', 'NETWORK', 'GEOLOCATION', 'DEEP_LINK', 'MANUAL'];
const actionTypes: ActionType[] = ['WEBHOOK', 'NOTIFICATION', 'LOG'];

const flowSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  trigger: z.object({
    type: z.enum(['NATIVE_BATTERY', 'NETWORK', 'GEOLOCATION', 'DEEP_LINK', 'MANUAL']),
    details: z.record(z.any()),
  }),
  actions: z.array(z.object({
    type: z.enum(['WEBHOOK', 'NOTIFICATION', 'LOG']),
    details: z.record(z.any()),
  })).min(1, 'At least one action is required'),
});

type FlowFormValues = z.infer<typeof flowSchema>;

interface FlowFormProps {
  flow?: Flow;
  onSave: (flow: Omit<Flow, 'id'>) => void;
  onCancel: () => void;
}

export function FlowForm({ flow, onSave, onCancel }: FlowFormProps) {
  const defaultValues: Partial<FlowFormValues> = flow
    ? {
        name: flow.name,
        trigger: flow.trigger,
        actions: flow.actions,
      }
    : {
        name: '',
        trigger: { type: 'MANUAL', details: {} },
        actions: [{ type: 'LOG', details: {} }],
      };

  const form = useForm<FlowFormValues>({
    resolver: zodResolver(flowSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'actions',
  });

  const triggerType = form.watch('trigger.type');

  function onSubmit(data: FlowFormValues) {
    onSave({
      ...data,
      enabled: flow ? flow.enabled : true, // Default to enabled for new flows
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-4 border rounded-lg bg-card">
        <h3 className="text-lg font-bold mb-4">{flow ? 'Edit Flow' : 'Create Flow'}</h3>

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Flow Name</FormLabel>
              <FormControl>
                <Input placeholder="My Automation Flow" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4 border p-4 rounded-md">
            <h4 className="font-medium">Trigger</h4>
            <FormField
            control={form.control}
            name="trigger.type"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a trigger" />
                    </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                    {triggerTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                        {type}
                        </SelectItem>
                    ))}
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}
            />

            {triggerType === 'DEEP_LINK' && (
                <FormField
                    control={form.control}
                    name="trigger.details.event"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Event Name</FormLabel>
                        <FormControl>
                        <Input placeholder="e.g., left_work" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormDescription>
                            Trigger via URL: /?event={field.value || 'your_event'}
                        </FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            )}

            {triggerType === 'NETWORK' && (
                <FormField
                    control={form.control}
                    name="trigger.details.ssid"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>SSID (Network Name)</FormLabel>
                        <FormControl>
                        <Input placeholder="e.g., Home-WiFi" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormDescription>
                            Trigger when connecting to this specific network.
                        </FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            )}

            {triggerType === 'GEOLOCATION' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="trigger.details.latitude"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Latitude</FormLabel>
                                <FormControl>
                                <Input 
                                    type="number" 
                                    step="any" 
                                    placeholder="0.0" 
                                    {...field} 
                                    onChange={e => field.onChange(parseFloat(e.target.value))}
                                    value={field.value === undefined ? '' : field.value} 
                                />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="trigger.details.longitude"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Longitude</FormLabel>
                                <FormControl>
                                <Input 
                                    type="number" 
                                    step="any" 
                                    placeholder="0.0" 
                                    {...field} 
                                    onChange={e => field.onChange(parseFloat(e.target.value))}
                                    value={field.value === undefined ? '' : field.value} 
                                />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="trigger.details.radius"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Radius (meters)</FormLabel>
                                <FormControl>
                                <Input 
                                    type="number" 
                                    placeholder="100" 
                                    {...field} 
                                    onChange={e => field.onChange(parseInt(e.target.value))}
                                    value={field.value === undefined ? '' : field.value} 
                                />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="trigger.details.event"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Event</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value || 'ENTER'}>
                                    <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select event" />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="ENTER">Enters Zone</SelectItem>
                                        <SelectItem value="EXIT">Exits Zone</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>
                    
                    <Button 
                        type="button" 
                        variant="secondary" 
                        size="sm" 
                        className="w-full"
                        onClick={() => {
                            navigator.geolocation.getCurrentPosition((pos) => {
                                form.setValue('trigger.details.latitude', pos.coords.latitude);
                                form.setValue('trigger.details.longitude', pos.coords.longitude);
                                if (!form.getValues('trigger.details.radius')) {
                                    form.setValue('trigger.details.radius', 100);
                                }
                            });
                        }}
                    >
                        Use Current Location
                    </Button>
                </div>
            )}
        </div>

        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="font-medium">Actions</h4>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ type: 'LOG', details: {} })}>
                    <PlusCircle className="mr-2 h-4 w-4"/> Add Action
                </Button>
            </div>

            {fields.map((field, index) => (
                <Card key={field.id}>
                    <CardContent className="pt-6 relative">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-2 top-2 text-destructive"
                            onClick={() => remove(index)}
                            disabled={fields.length === 1}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        <div className="grid gap-4">
                             <FormField
                                control={form.control}
                                name={`actions.${index}.type`}
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Action Type</FormLabel>
                                    <Select
                                        onValueChange={(value) => {
                                            field.onChange(value);
                                            // Reset details when type changes
                                            form.setValue(`actions.${index}.details`, {});
                                        }}
                                        defaultValue={field.value}
                                    >
                                        <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select an action" />
                                        </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                        {actionTypes.map((type) => (
                                            <SelectItem key={type} value={type}>
                                            {type}
                                            </SelectItem>
                                        ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />

                                <ActionDetails index={index} form={form} />
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">Save Flow</Button>
        </div>
      </form>
    </Form>
  );
}

function ActionDetails({ index, form }: { index: number, form: UseFormReturn<FlowFormValues> }) {
    const type = form.watch(`actions.${index}.type`);

    if (type === 'WEBHOOK') {
        return (
            <FormField
                control={form.control}
                name={`actions.${index}.details.url`}
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Webhook URL</FormLabel>
                    <FormControl>
                    <Input placeholder="https://api.example.com/webhook" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
        );
    }

    if (type === 'NOTIFICATION') {
        return (
            <>
                <FormField
                    control={form.control}
                    name={`actions.${index}.details.title`}
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                        <Input placeholder="Notification Title" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name={`actions.${index}.details.body`}
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Body</FormLabel>
                        <FormControl>
                        <Input placeholder="Notification Body" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
            </>
        );
    }

     if (type === 'LOG') {
        return (
             <FormField
                control={form.control}
                name={`actions.${index}.details.message`}
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Log Message</FormLabel>
                    <FormControl>
                    <Input placeholder="Log this message" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
                )}
            />
        )
    }

    return null;
}
