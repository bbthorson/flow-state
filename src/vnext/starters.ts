import type { Flow } from '@flowstate/core';

/**
 * Curated starter flows & app primitives for a fresh Context.
 * Demonstrates pinned schema-driven primitives, edge-triggered sensors, and deep-link ingest.
 */
export function createStarterFlows(contextId: string): { flows: Flow[]; pinIds: string[] } {
  const now = new Date().toISOString();
  const ts = Date.now();

  const checkInId = `starter-checkin-${ts}`;
  const lowBatId = `starter-lowbat-${ts}`;
  const shortcutId = `starter-shortcut-${ts}`;

  const flows: Flow[] = [
    {
      id: checkInId,
      contextId,
      name: 'Quick Focus Check-in',
      description: 'Pinned app primitive: log your current focus intent and copy a timestamped note.',
      trigger: { eventType: 'user.manual.invoked' },
      inputs: [
        {
          name: 'intent',
          label: 'What are you focusing on?',
          type: 'string',
          required: true,
          description: 'e.g. Finish API design',
        },
      ],
      steps: [
        {
          kind: 'command',
          id: 'step-emit',
          targetCapability: 'local.event',
          action: 'emit',
          space: contextId,
          input: {
            event: 'focus.checkin',
            title: 'Focus: {{inputs.intent}}',
            body: 'Started at {{time.iso}}',
          },
        },
        {
          kind: 'command',
          id: 'step-log',
          targetCapability: 'local.log',
          action: 'write',
          input: { message: 'Focus intent recorded: {{inputs.intent}}' },
        },
      ],
      active: true,
      dryRun: false,
      executionTarget: 'device',
      createdAt: now,
    },
    {
      id: lowBatId,
      contextId,
      name: 'Low Battery Notice',
      description: 'Edge-triggered: notifies once when battery drops to 20% or below while unplugged.',
      trigger: {
        eventType: 'device.battery.changed',
        edgeTriggered: true,
        where: [
          { field: 'event.payload.charging', operator: 'eq', value: 'false' },
          { field: 'event.payload.level', operator: 'lte', value: '0.2' },
        ],
      },
      inputs: [],
      steps: [
        {
          kind: 'command',
          id: 'step-notify',
          targetCapability: 'local.notification',
          action: 'show',
          input: {
            title: 'Battery low',
            body: 'Battery dropped to {{event.payload.level}} — plug in soon.',
          },
        },
      ],
      active: true,
      dryRun: false,
      executionTarget: 'device',
      createdAt: now,
    },
    {
      id: shortcutId,
      contextId,
      name: 'Deep Link / Shortcut Capture',
      description: 'Receives untrusted URL query params from Apple Shortcuts or external links safely.',
      trigger: { eventType: 'system.deeplink.received' },
      inputs: [],
      steps: [
        {
          kind: 'command',
          id: 'step-log-dl',
          targetCapability: 'local.log',
          action: 'write',
          input: { message: 'Deep link received: {{event.payload.event}}' },
        },
      ],
      active: true,
      dryRun: false,
      executionTarget: 'device',
      createdAt: now,
    },
  ];

  return { flows, pinIds: [checkInId] };
}
