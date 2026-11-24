import type { ActionStep, ActionType, ConditionStep, Flow, FlowStep, VariableStep } from '@/types';
import { newStepId } from '@/lib/steps';

export type FlowTemplate = Omit<Flow, 'id' | 'createdAt'>;

const act = (type: ActionType, details: Record<string, any>, extra?: Partial<ActionStep>): ActionStep => ({
  type: 'action',
  id: newStepId(),
  action: { type, details },
  ...extra,
});

const when = (assertions: ConditionStep['assertions'], extra?: Partial<ConditionStep>): ConditionStep => ({
  type: 'condition',
  id: newStepId(),
  assertions,
  ...extra,
});

const variable = (name: string, extra: Omit<VariableStep, 'type' | 'id' | 'name'>): VariableStep => ({
  type: 'variable',
  id: newStepId(),
  name,
  ...extra,
});

const starter = (t: Omit<FlowTemplate, 'dryRun'> & { steps: FlowStep[] }): FlowTemplate => ({ dryRun: false, ...t });

export const STARTER_FLOWS: FlowTemplate[] = [
  starter({
    name: 'Low Battery Alert',
    description: 'Get notified as soon as your device battery drops below 20% while unplugged.',
    tags: ['battery', 'utility'],
    active: true,
    trigger: { type: 'NATIVE_BATTERY', details: { charging: false, level: 0.2 } },
    steps: [act('NOTIFICATION', { title: 'Battery Low', body: 'Your battery is below 20%. Consider plugging in.' })],
  }),
  starter({
    name: 'Home WiFi Connect',
    description: 'Trigger a welcome notification when you connect to your home wireless network.',
    tags: ['network', 'home'],
    active: false,
    trigger: { type: 'NETWORK', details: { online: true } },
    steps: [act('NOTIFICATION', { title: 'Welcome Home', body: 'You connected to your home network.' })],
  }),
  starter({
    name: 'Manual Webhook Ping',
    description: 'Test one-tap automation execution with a local notification.',
    tags: ['test', 'utility'],
    active: true,
    trigger: { type: 'MANUAL', details: {} },
    steps: [act('NOTIFICATION', { title: 'Manual Trigger', body: 'Flow State ran a manual flow successfully.' })],
  }),
  starter({
    name: 'Shake to Share',
    description: 'Shake your phone to open the share sheet — only during the day, so a bumpy night bus stays quiet.',
    tags: ['motion', 'social'],
    active: false,
    trigger: { type: 'DEVICE_MOTION', details: { gesture: 'SHAKE' } },
    steps: [
      when(
        [
          { field: 'time.hour', operator: 'gte', value: '8' },
          { field: 'time.hour', operator: 'lt', value: '22' },
        ],
        { comment: 'Daytime only' },
      ),
      act('WEB_SHARE', { title: 'Shared via Flow State', text: 'Check this out!' }),
    ],
  }),
  starter({
    name: 'Morning Kickoff',
    description: 'Start your workday at 9:00 AM with a morning focus prompt, and a nudge ten minutes later.',
    tags: ['time', 'routine'],
    active: false,
    trigger: { type: 'TIME', details: { time: '09:00', days: [1, 2, 3, 4, 5] } },
    steps: [
      act('NOTIFICATION', {
        title: 'Start your day',
        body: "It's {{trigger.time}} on {{trigger.day}} — time to get into flow.",
      }),
      act(
        'NOTIFICATION',
        { title: 'Still with us?', body: 'Ten minutes in. Pick the one thing for this block.' },
        { schedule: { identifier: 'morning-nudge', delay: { unit: 'm', value: { kind: 'literal', n: 10 } } } },
      ),
    ],
  }),
  starter({
    name: 'Idle Screen Alert',
    description: 'Notify if your device stays inactive — but only if it is not charging.',
    tags: ['idle', 'focus'],
    active: false,
    trigger: { type: 'IDLE', details: { threshold: 120000, detectScreen: false } },
    steps: [
      when([{ field: 'device.battery.charging', operator: 'eq', value: 'false' }]),
      act('NOTIFICATION', { title: 'Still there?', body: "You've been idle for a while." }),
    ],
  }),
  starter({
    name: 'Discord Channel Alert',
    description: 'Post a webhook message to your Discord channel when battery is low.',
    tags: ['webhook', 'social', 'battery'],
    active: false,
    trigger: { type: 'NATIVE_BATTERY', details: { charging: false, level: 0.15 } },
    steps: [
      variable('webhook_url', {
        kind: 'secret',
        label: 'Discord Webhook URL',
        note: 'Your Discord channel incoming webhook URL',
        required: true,
      }),
      act('WEBHOOK', {
        url: '{{webhook_url}}',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'My phone battery just dropped below 15%!' }),
      }),
    ],
  }),
];
