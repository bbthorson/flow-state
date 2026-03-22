import { Flow } from '@/types';

export type FlowTemplate = Omit<Flow, 'id'>;

export const STARTER_FLOWS: FlowTemplate[] = [
  {
    name: 'Low Battery Alert',
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
];
