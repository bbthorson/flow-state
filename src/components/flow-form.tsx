import { useState } from 'react';
import { useForm, useFieldArray, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Flow, TriggerType, ActionType } from '@/types';
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
import { Trash2, PlusCircle, ShieldAlert, Sparkles, Loader2 } from 'lucide-react';
import { VariableHints } from './variable-hints';
import { usePermissions } from '@/hooks/usePermissions';
import { useLanguageModel, generateFlow } from '@/hooks/useLanguageModel';
import {
    TRIGGER_PERMISSIONS,
    ACTION_PERMISSIONS,
    PERMISSION_LABELS,
    requestPermission,
    DevicePermission,
} from '@/lib/permissions';

const triggerTypes: TriggerType[] = ['NATIVE_BATTERY', 'NETWORK', 'GEOLOCATION', 'DEEP_LINK', 'MANUAL', 'IDLE', 'DEVICE_MOTION', 'SCREEN_ORIENTATION'];
const actionTypes: ActionType[] = ['WEBHOOK', 'NOTIFICATION', 'LOG', 'VIBRATION', 'CLIPBOARD', 'WEB_SHARE', 'WAKE_LOCK', 'SPEECH'];

const TRIGGER_LABELS: Record<TriggerType, string> = {
    NATIVE_BATTERY: 'Battery',
    NETWORK: 'Network',
    GEOLOCATION: 'Geolocation',
    DEEP_LINK: 'Deep Link',
    MANUAL: 'Manual',
    IDLE: 'Idle Detection',
    DEVICE_MOTION: 'Device Motion',
    SCREEN_ORIENTATION: 'Screen Orientation',
};

const ACTION_LABELS: Record<ActionType, string> = {
    WEBHOOK: 'Webhook',
    NOTIFICATION: 'Notification',
    LOG: 'Log',
    VIBRATION: 'Vibration',
    CLIPBOARD: 'Copy to Clipboard',
    WEB_SHARE: 'Share',
    WAKE_LOCK: 'Wake Lock',
    SPEECH: 'Text to Speech',
};

const flowSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    trigger: z.object({
        type: z.enum(['NATIVE_BATTERY', 'NETWORK', 'GEOLOCATION', 'DEEP_LINK', 'MANUAL', 'IDLE', 'DEVICE_MOTION', 'SCREEN_ORIENTATION']),
        details: z.record(z.any()),
    }),
    actions: z.array(z.object({
        type: z.enum(['WEBHOOK', 'NOTIFICATION', 'LOG', 'VIBRATION', 'CLIPBOARD', 'WEB_SHARE', 'WAKE_LOCK', 'SPEECH']),
        details: z.record(z.any()),
    })).min(1, 'At least one action is required'),
});

type FlowFormValues = z.infer<typeof flowSchema>;

interface FlowFormProps {
    flow?: Flow;
    onSave: (flow: Omit<Flow, 'id'>) => void;
    onCancel: () => void;
}

function PermissionWarning({ unmet, permissions }: {
    unmet: DevicePermission[];
    permissions: Record<DevicePermission, string>;
}) {
    if (unmet.length === 0) return null;

    const handleRequest = async (perm: DevicePermission) => {
        await requestPermission(perm);
    };

    return (
        <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3 text-sm">
            <ShieldAlert className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
            <div className="space-y-1">
                <p className="font-medium text-yellow-700 dark:text-yellow-400">Missing permissions</p>
                {unmet.map((perm) => {
                    const state = permissions[perm];
                    return (
                        <div key={perm} className="text-xs text-muted-foreground">
                            {PERMISSION_LABELS[perm]}
                            {state === 'prompt' && (
                                <button
                                    type="button"
                                    onClick={() => handleRequest(perm)}
                                    className="ml-2 text-blue-500 hover:underline"
                                >
                                    Grant
                                </button>
                            )}
                            {state === 'denied' && ' — enable in browser settings'}
                            {state === 'unavailable' && ' — not supported on this device'}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function AiFlowInput({ onGenerated }: { onGenerated: (data: { name: string; trigger: any; actions: any[] }) => void }) {
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!input.trim()) return;
        setLoading(true);
        setError(null);
        const result = await generateFlow(input.trim());
        setLoading(false);
        if (result) {
            onGenerated(result);
            setInput('');
        } else {
            setError('Could not generate a flow from that description. Try being more specific.');
        }
    };

    return (
        <div className="space-y-2 rounded-md border border-dashed border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                <Sparkles className="h-3 w-3" />
                <span>Describe your automation</span>
            </div>
            <div className="flex gap-2">
                <Input
                    placeholder="e.g. Notify me when my battery drops below 20%"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleGenerate())}
                    disabled={loading}
                />
                <Button type="button" size="sm" onClick={handleGenerate} disabled={loading || !input.trim()}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate'}
                </Button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <p className="text-[10px] text-muted-foreground">Powered by on-device AI. Nothing leaves your device.</p>
        </div>
    );
}

export function FlowForm({ flow, onSave, onCancel }: FlowFormProps) {
    const permissions = usePermissions();
    const aiAvailability = useLanguageModel();
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
    const watchedActions = form.watch('actions');

    // Compute unmet permissions for current form state
    const allPerms = new Set<DevicePermission>();
    for (const p of TRIGGER_PERMISSIONS[triggerType as TriggerType] || []) allPerms.add(p);
    for (const action of watchedActions || []) {
        for (const p of ACTION_PERMISSIONS[action.type as ActionType] || []) allPerms.add(p);
    }
    const unmetPerms = Array.from(allPerms).filter((p) => permissions[p] !== 'granted');

    function onSubmit(data: FlowFormValues) {
        onSave({
            ...data,
            enabled: flow ? flow.enabled : true, // Default to enabled for new flows
        });
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold tracking-tight">{flow ? 'Edit Flow' : 'Create Flow'}</h2>
                    <div className="flex gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
                            Cancel
                        </Button>
                        <Button type="submit" size="sm">Save Flow</Button>
                    </div>
                </div>

                {!flow && aiAvailability !== 'unavailable' && (
                    <AiFlowInput onGenerated={(data) => {
                        form.setValue('name', data.name);
                        form.setValue('trigger.type', data.trigger.type as any);
                        form.setValue('trigger.details', data.trigger.details || {});
                        while (fields.length > 0) remove(0);
                        data.actions.forEach((action) => append({ type: action.type as any, details: action.details || {} }));
                    }} />
                )}

                <Card>
                    <CardContent className="p-4 space-y-4">
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

                        <FormField
                            control={form.control}
                            name="trigger.type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>When this happens...</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a trigger" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {triggerTypes.map((type) => (
                                                <SelectItem key={type} value={type}>
                                                    {TRIGGER_LABELS[type]}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                    {triggerType === 'IDLE' && (
                        <div className="space-y-4">
                            <FormField
                                control={form.control}
                                name="trigger.details.threshold"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Idle Threshold (seconds)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min="60"
                                                placeholder="60"
                                                {...field}
                                                onChange={e => field.onChange(parseInt(e.target.value) * 1000)}
                                                value={field.value ? Math.round(field.value / 1000) : ''}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            How long the user must be idle before triggering (min 60s).
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="trigger.details.detectScreen"
                                render={({ field }) => (
                                    <FormItem className="flex items-center gap-2">
                                        <FormControl>
                                            <input
                                                type="checkbox"
                                                checked={field.value || false}
                                                onChange={field.onChange}
                                                className="h-4 w-4 rounded border"
                                            />
                                        </FormControl>
                                        <FormLabel className="!mt-0">Also trigger on screen lock</FormLabel>
                                    </FormItem>
                                )}
                            />
                        </div>
                    )}

                    {triggerType === 'DEVICE_MOTION' && (
                        <FormField
                            control={form.control}
                            name="trigger.details.gesture"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Gesture</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value || 'SHAKE'}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select gesture" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="SHAKE">Shake</SelectItem>
                                            <SelectItem value="FACE_DOWN">Face Down</SelectItem>
                                            <SelectItem value="FACE_UP">Face Up</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}

                    {triggerType === 'SCREEN_ORIENTATION' && (
                        <FormField
                            control={form.control}
                            name="trigger.details.orientation"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Orientation</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value || 'landscape'}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select orientation" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="portrait">Portrait</SelectItem>
                                            <SelectItem value="landscape">Landscape</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}

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
                    </CardContent>
                </Card>

                <PermissionWarning unmet={unmetPerms} permissions={permissions} />

                <Card>
                    <CardContent className="p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <FormLabel className="text-base">...do this</FormLabel>
                            <Button type="button" variant="outline" size="sm" onClick={() => append({ type: 'LOG', details: {} })}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Add Action
                            </Button>
                        </div>

                        <VariableHints type={triggerType} />

                        {fields.map((field, index) => (
                            <div key={field.id} className="space-y-3 rounded-md border p-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-muted-foreground shrink-0">#{index + 1}</span>
                                    <div className="flex-1">
                                        <FormField
                                            control={form.control}
                                            name={`actions.${index}.type`}
                                            render={({ field }) => (
                                                <Select
                                                    onValueChange={(value) => {
                                                        field.onChange(value);
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
                                                                {ACTION_LABELS[type]}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="shrink-0 text-destructive h-8 w-8"
                                        onClick={() => remove(index)}
                                        disabled={fields.length === 1}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>

                                <ActionDetails index={index} form={form} />
                            </div>
                        ))}
                    </CardContent>
                </Card>
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

    if (type === 'VIBRATION') {
        return (
            <FormField
                control={form.control}
                name={`actions.${index}.details.duration`}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Duration (ms)</FormLabel>
                        <FormControl>
                            <Input
                                type="number"
                                min="50"
                                placeholder="200"
                                {...field}
                                onChange={e => field.onChange(parseInt(e.target.value))}
                                value={field.value === undefined ? '' : field.value}
                            />
                        </FormControl>
                        <FormDescription>Vibration duration in milliseconds.</FormDescription>
                        <FormMessage />
                    </FormItem>
                )}
            />
        );
    }

    if (type === 'CLIPBOARD') {
        return (
            <FormField
                control={form.control}
                name={`actions.${index}.details.text`}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Text</FormLabel>
                        <FormControl>
                            <Input placeholder="Text to copy — supports {{variables}}" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        );
    }

    if (type === 'WEB_SHARE') {
        return (
            <>
                <FormField
                    control={form.control}
                    name={`actions.${index}.details.title`}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Title</FormLabel>
                            <FormControl>
                                <Input placeholder="Share title" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name={`actions.${index}.details.text`}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Text</FormLabel>
                            <FormControl>
                                <Input placeholder="Share text — supports {{variables}}" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name={`actions.${index}.details.url`}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>URL</FormLabel>
                            <FormControl>
                                <Input placeholder="https://example.com" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </>
        );
    }

    if (type === 'WAKE_LOCK') {
        return (
            <FormField
                control={form.control}
                name={`actions.${index}.details.duration`}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Duration (seconds, optional)</FormLabel>
                        <FormControl>
                            <Input
                                type="number"
                                min="1"
                                placeholder="Leave empty to hold indefinitely"
                                {...field}
                                onChange={e => {
                                    const val = e.target.value ? parseInt(e.target.value) * 1000 : undefined;
                                    field.onChange(val);
                                }}
                                value={field.value ? Math.round(field.value / 1000) : ''}
                            />
                        </FormControl>
                        <FormDescription>Auto-release after this many seconds. Leave empty to hold until page closes.</FormDescription>
                        <FormMessage />
                    </FormItem>
                )}
            />
        );
    }

    if (type === 'SPEECH') {
        return (
            <>
                <FormField
                    control={form.control}
                    name={`actions.${index}.details.text`}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Text</FormLabel>
                            <FormControl>
                                <Input placeholder="Text to speak — supports {{variables}}" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="grid grid-cols-3 gap-4">
                    <FormField
                        control={form.control}
                        name={`actions.${index}.details.rate`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Rate</FormLabel>
                                <FormControl>
                                    <Input
                                        type="number"
                                        step="0.1"
                                        min="0.1"
                                        max="10"
                                        placeholder="1.0"
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
                        name={`actions.${index}.details.pitch`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Pitch</FormLabel>
                                <FormControl>
                                    <Input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="2"
                                        placeholder="1.0"
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
                        name={`actions.${index}.details.volume`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Volume</FormLabel>
                                <FormControl>
                                    <Input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="1"
                                        placeholder="1.0"
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
            </>
        );
    }

    return null;
}
