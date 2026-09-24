import { Flow } from '@/types';

export type FlowTemplate = Omit<Flow, 'id'>;

export const STARTER_FLOWS: FlowTemplate[] = [
  {
    name: 'Low Battery Alert',
    description: 'Get notified as soon as your device battery drops below 20% while unplugged.',
    tags: ['battery', 'utility'],
    enabled: true,
    trigger: {
      type: 'NATIVE_BATTERY',
      details: { charging: false, level: 0.2 },
    },
    actions: [
      {
        type: 'NOTIFICATION',
        details: {
          title: 'Battery Low',
          body: 'Your battery is below 20%. Consider plugging in.',
        },
      },
    ],
  },
  {
    name: 'Home WiFi Connect',
    description: 'Trigger a welcome notification when you connect to your home wireless network.',
    tags: ['network', 'home'],
    enabled: false,
    trigger: {
      type: 'NETWORK',
      details: { online: true, ssid: 'Home-WiFi' },
    },
    actions: [
      {
        type: 'NOTIFICATION',
        details: {
          title: 'Welcome Home',
          body: 'You connected to your home network.',
        },
      },
    ],
  },
  {
    name: 'Manual Webhook Ping',
    description: 'Test one-tap automation execution with a local notification.',
    tags: ['test', 'utility'],
    enabled: true,
    trigger: {
      type: 'MANUAL',
      details: {},
    },
    actions: [
      {
        type: 'NOTIFICATION',
        details: {
          title: 'Manual Trigger',
          body: 'Flow State ran a manual flow successfully.',
        },
      },
    ],
  },
  {
    name: 'Shake to Share',
    description: 'Shake your phone to open the native share sheet with a custom message.',
    tags: ['motion', 'social'],
    enabled: false,
    trigger: {
      type: 'DEVICE_MOTION',
      details: { gesture: 'SHAKE' },
    },
    actions: [
      {
        type: 'WEB_SHARE',
        details: {
          title: 'Shared via Flow State',
          text: 'Check this out!',
        },
      },
    ],
  },
  {
    name: 'Morning Kickoff',
    description: 'Start your workday at 9:00 AM with a morning focus prompt.',
    tags: ['time', 'routine'],
    enabled: false,
    trigger: {
      type: 'TIME',
      details: { time: '09:00', days: [1, 2, 3, 4, 5] },
    },
    actions: [
      {
        type: 'NOTIFICATION',
        details: {
          title: 'Start your day',
          body: 'It\'s {{time}} on {{day}} — time to get into flow.',
        },
      },
    ],
  },
  {
    name: 'Idle Screen Alert',
    description: 'Vibrate and notify if your device screen remains inactive for 2 minutes.',
    tags: ['idle', 'focus'],
    enabled: false,
    trigger: {
      type: 'IDLE',
      details: { threshold: 120000, detectScreen: false },
    },
    actions: [
      {
        type: 'NOTIFICATION',
        details: {
          title: 'Still there?',
          body: 'You\'ve been idle for 2 minutes.',
        },
      },
    ],
  },
  {
    name: 'Discord Channel Alert',
    description: 'Post a webhook message to your Discord channel when battery is low.',
    tags: ['webhook', 'social', 'battery'],
    enabled: false,
    parameters: [
      {
        key: 'webhook_url',
        label: 'Discord Webhook URL',
        description: 'Your Discord channel incoming webhook URL',
        type: 'secret',
        required: true,
      },
    ],
    trigger: {
      type: 'NATIVE_BATTERY',
      details: { charging: false, level: 0.15 },
    },
    actions: [
      {
        type: 'WEBHOOK',
        details: {
          url: '{{secrets.webhook_url}}',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: '🔋 My phone battery just dropped below 15%!' }),
        },
      },
    ],
  },
];
