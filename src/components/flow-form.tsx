import { useState } from 'react';
import { useForm, useFieldArray, UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Flow, TriggerType, ActionType, FlowStep } from '@/types';
import { Switch } from '@/components/ui/switch';
import { StepsEditor } from '@/components/steps-editor';
import { actionSteps, newStepId } from '@/lib/steps';
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
import { ShieldAlert, Sparkles, Loader2, ArrowLeft } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { VariableHints } from './variable-hints';
import { usePermissions } from '@/hooks/usePermissions';
import { useLanguageModel, generateFlow } from '@/hooks/useLanguageModel';
import {
    TRIGGER_PERMISSIONS,
    ACTION_PERMISSIONS,
    requestPermission,
    DevicePermission,
    PermissionState,
} from '@/lib/permissions';
import { TRIGGER_LABELS, TRIGGER_TYPES } from '@/lib/flow-constants';
import { PermissionHint } from '@/components/permission-hint';
import { DAY_LABELS } from '@/lib/schedule';
import { cn } from '@/lib/utils';

const flowSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    trigger: z.object({
        type: z.enum(TRIGGER_TYPES as [TriggerType, ...TriggerType[]]),
        details: z.record(z.any()),
    }),
    // Steps are validated structurally on save by the engine's schema; the
    // editor keeps them loosely typed so partially filled rows don't block typing.
    steps: z.array(z.any()),
    dryRun: z.boolean(),
    secrets: z.record(z.string()),
});

export type FlowFormValues = z.infer<typeof flowSchema>;

export type FlowFormResult = Pick<Flow, 'name' | 'trigger' | 'steps' | 'dryRun' | 'secrets'>;

interface FlowFormProps {
    flow?: Flow;
    onSave: (changes: FlowFormResult) => void;
    onCancel: () => void;
}

function PermissionWarning({ unmet, permissions }: {
    unmet: DevicePermission[];
    permissions: Record<DevicePermission, PermissionState>;
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
                {unmet.map((perm) => (
                    <div key={perm}>
                        <PermissionHint permission={perm} state={permissions[perm]} onRequest={handleRequest} />
                    </div>
                ))}
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
    const defaultValues: FlowFormValues = {
        name: flow?.name ?? '',
        trigger: flow?.trigger ?? { type: 'MANUAL', details: {} },
        steps: flow?.steps?.length
            ? structuredClone(flow.steps)
            : [{ type: 'action', id: newStepId(), action: { type: 'LOG', details: {} } }],
        dryRun: flow?.dryRun ?? false,
        secrets: { ...(flow?.secrets ?? {}) },
    };

    const form = useForm<FlowFormValues>({
        resolver: zodResolver(flowSchema),
        defaultValues,
    });

    const stepsArray = useFieldArray({ control: form.control, name: 'steps' as never, keyName: 'key' });

    const triggerType = form.watch('trigger.type');
    const watchedSteps = (form.watch('steps') ?? []) as FlowStep[];

    // Compute unmet permissions for current form state
    const allPerms = new Set<DevicePermission>();
    for (const p of TRIGGER_PERMISSIONS[triggerType as TriggerType] || []) allPerms.add(p);
    for (const { action } of actionSteps(watchedSteps)) {
        for (const p of ACTION_PERMISSIONS[action.type as ActionType] || []) allPerms.add(p);
    }
    const unmetPerms = Array.from(allPerms).filter((p) => permissions[p] !== 'granted');

    function onSubmit(data: FlowFormValues) {
        // Secrets only for variables that still exist and are secret.
        const secretNames = new Set(
            (data.steps as FlowStep[]).filter((s) => s.type === 'variable' && s.kind === 'secret').map((s) => (s as { name: string }).name),
        );
        const secrets = Object.fromEntries(
            Object.entries(data.secrets ?? {}).filter(([k, v]) => (secretNames.has(k) || k === 'securityKey') && v !== ''),
        );
        onSave({
            name: data.name,
            trigger: data.trigger as Flow['trigger'],
            steps: data.steps as FlowStep[],
            dryRun: data.dryRun,
            ...(Object.keys(secrets).length ? { secrets } : { secrets: undefined }),
        });
    }

    const name = form.watch('name');
    const isValid = name?.trim().length > 0;

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="flex items-center gap-3">
                    <Button type="button" variant="ghost" size="icon" className="shrink-0 -ml-2" onClick={onCancel} aria-label="Back">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <h2 className="text-2xl font-bold tracking-tight">{flow ? 'Edit Flow' : 'Create Flow'}</h2>
                </div>

                {!flow && aiAvailability !== 'unavailable' && (
                    <AiFlowInput onGenerated={(data) => {
                        form.setValue('name', data.name);
                        form.setValue('trigger.type', data.trigger.type as any);
                        form.setValue('trigger.details', data.trigger.details || {});
                        stepsArray.replace(
                            data.actions.map((action) => ({
                                type: 'action',
                                id: newStepId(),
                                action: { type: action.type as ActionType, details: action.details || {} },
                            })) as never,
                        );
                    }} />
                )}

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

                <Accordion type="multiple" defaultValue={['trigger', 'actions']}>
                  <AccordionItem value="trigger">
                    <AccordionTrigger className="text-sm">
                      When this happens — <span className="text-muted-foreground ml-1">{TRIGGER_LABELS[triggerType as TriggerType] || 'Select'}</span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4">
                    <FormField
                        control={form.control}
                        name="trigger.type"
                        render={({ field }) => (
                            <FormItem>
                                <Select
                                    onValueChange={(value) => {
                                        field.onChange(value);
                                        if (value === 'TIME' && !form.getValues('trigger.details.time')) {
                                            form.setValue('trigger.details', { time: '09:00', days: [] });
                                        }
                                    }}
                                    defaultValue={field.value}
                                >
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a trigger" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {TRIGGER_TYPES.map((type) => (
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

                    {triggerType === 'EVENT' && (
                        <div className="space-y-4">
                            <FormField
                                control={form.control}
                                name="trigger.details.event"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Event Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g., arrived-home, or * for any" {...field} value={field.value || ''} />
                                        </FormControl>
                                        <FormDescription>
                                            Fires when another flow on this device emits this event.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="trigger.details.exposeData"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Readable data keys</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="e.g., room, minutes"
                                                defaultValue={Array.isArray(field.value) ? field.value.join(', ') : ''}
                                                onBlur={(e) => {
                                                    const keys = e.target.value.split(',').map((k) => k.trim()).filter(Boolean);
                                                    field.onChange(keys.length ? keys : undefined);
                                                }}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            Only these keys of the event's data are visible, as {'{{event.data.<key>}}'}.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    )}

                    {triggerType === 'TIME' && (
                        <div className="space-y-4">
                            <FormField
                                control={form.control}
                                name="trigger.details.time"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Time</FormLabel>
                                        <FormControl>
                                            <Input type="time" {...field} value={field.value ?? '09:00'} />
                                        </FormControl>
                                        <FormDescription>
                                            Runs while the app is open. If it's closed at the scheduled minute, the flow waits until the next occurrence — a PWA can't wake in the background.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="trigger.details.days"
                                render={({ field }) => {
                                    const days: number[] = Array.isArray(field.value) ? field.value : [];
                                    const toggle = (d: number) =>
                                        field.onChange(
                                            days.includes(d)
                                                ? days.filter((x) => x !== d)
                                                : [...days, d].sort((a, b) => a - b),
                                        );
                                    return (
                                        <FormItem>
                                            <FormLabel>Days</FormLabel>
                                            <div className="flex gap-1">
                                                {DAY_LABELS.map((label, d) => (
                                                    <button
                                                        type="button"
                                                        key={d}
                                                        onClick={() => toggle(d)}
                                                        className={cn(
                                                            'h-9 w-9 rounded-md border text-xs font-medium transition-colors',
                                                            days.includes(d)
                                                                ? 'border-primary bg-primary text-primary-foreground'
                                                                : 'text-muted-foreground hover:bg-muted',
                                                        )}
                                                    >
                                                        {label[0]}
                                                    </button>
                                                ))}
                                            </div>
                                            <FormDescription>Leave all off to run every day.</FormDescription>
                                        </FormItem>
                                    );
                                }}
                            />
                        </div>
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
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="steps">
                    <AccordionTrigger className="text-sm">
                      ...do this — <span className="text-muted-foreground ml-1">{watchedSteps.length} step{watchedSteps.length !== 1 ? 's' : ''}</span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4">
                        <VariableHints type={triggerType} />
                        <StepsEditor form={form} stepsArray={stepsArray} renderActionDetails={(prefix) => <ActionDetails prefix={prefix} form={form} />} />
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <FormField
                    control={form.control}
                    name="dryRun"
                    render={({ field }) => (
                        <FormItem className="flex items-center justify-between gap-3 rounded-md border p-3">
                            <div className="space-y-0.5">
                                <FormLabel>Dry run</FormLabel>
                                <FormDescription className="text-xs">Log what would happen without running any action.</FormDescription>
                            </div>
                            <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} aria-label="Dry run" />
                            </FormControl>
                        </FormItem>
                    )}
                />

                <PermissionWarning unmet={unmetPerms} permissions={permissions} />

                <Button type="submit" className="w-full" disabled={!isValid}>
                    Save Flow
                </Button>
            </form>
        </Form>
    );
}

// Field paths are built from a step prefix (e.g. `steps.2.action`), which
// react-hook-form can't type against the loosely typed steps array.
function ActionDetails({ prefix, form: typedForm }: { prefix: string, form: UseFormReturn<FlowFormValues> }) {
    const form = typedForm as unknown as UseFormReturn<any>;
    const type = form.watch(`${prefix}.type`);

    if (type === 'WEBHOOK') {
        return (
            <FormField
                control={form.control}
                name={`${prefix}.details.url`}
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
                    name={`${prefix}.details.title`}
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
                    name={`${prefix}.details.body`}
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
                name={`${prefix}.details.message`}
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
                name={`${prefix}.details.duration`}
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
                name={`${prefix}.details.text`}
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
                    name={`${prefix}.details.title`}
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
                    name={`${prefix}.details.text`}
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
                    name={`${prefix}.details.url`}
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
                name={`${prefix}.details.duration`}
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

    if (type === 'EMIT_EVENT') {
        const dataLines = Object.entries((form.watch(`${prefix}.details.data`) ?? {}) as Record<string, string>)
            .map(([k, v]) => `${k}=${v}`)
            .join('\n');
        return (
            <>
                <FormField
                    control={form.control}
                    name={`${prefix}.details.event`}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Event Name</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g., arrived-home" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormDescription>Flows with an Event trigger for this name will run.</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name={`${prefix}.details.title`}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Title</FormLabel>
                            <FormControl>
                                <Input placeholder="Optional — supports {{variables}}" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormItem>
                    <FormLabel>Data</FormLabel>
                    <FormControl>
                        <textarea
                            className="flex min-h-[64px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs placeholder:text-muted-foreground"
                            placeholder={'room={{trigger.room}}\nminutes=10'}
                            defaultValue={dataLines}
                            onBlur={(e) => {
                                const entries = e.target.value
                                    .split('\n')
                                    .map((line) => line.trim())
                                    .filter((line) => line.includes('='))
                                    .map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim()] as const)
                                    .filter(([k]) => k);
                                form.setValue(`${prefix}.details.data`, entries.length ? Object.fromEntries(entries) : undefined, { shouldDirty: true });
                            }}
                        />
                    </FormControl>
                    <FormDescription>One key=value per line. Receivers only see keys they list.</FormDescription>
                </FormItem>
            </>
        );
    }

    if (type === 'SPEECH') {
        return (
            <>
                <FormField
                    control={form.control}
                    name={`${prefix}.details.text`}
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
                        name={`${prefix}.details.rate`}
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
                        name={`${prefix}.details.pitch`}
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
                        name={`${prefix}.details.volume`}
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
