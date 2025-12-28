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
        type: 'WEBHOOK',
        details: {
          url: 'https://hooks.example.com/home-arrival',
          method: 'POST',
          body: JSON.stringify({ event: 'arrival', location: 'home' }),
        },
      },
    ],
  },
  {
    name: 'Siri Shortcut Trigger',
    enabled: true,
    trigger: {
      type: 'DEEP_LINK',
      details: { event: 'SHORTCUT' },
    },
    actions: [
      {
        type: 'NOTIFICATION',
        details: {
          title: 'Shortcut Executed',
          body: 'Flow State successfully triggered from iOS Shortcuts.',
        },
      },
    ],
  },
];
