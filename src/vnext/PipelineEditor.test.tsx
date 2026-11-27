import { describe, expect, it, vi } from 'vite-plus/test';
import { render, screen, fireEvent } from '@testing-library/react';
import { executeFlow, type Flow } from '@flowstate/core';
import { createBuiltinAdapters } from '@flowstate/adapters';
import { PipelineEditor } from './PipelineEditor';

describe('PipelineEditor — taint-aware token pills & live dry-run', () => {
  const capabilities = createBuiltinAdapters().map((a) => a.manifest);

  const webhookFlow: Flow = {
    id: 'f-wh',
    contextId: 'personal',
    name: 'Webhook Flow',
    trigger: { eventType: 'system.deeplink.received' },
    inputs: [],
    steps: [
      {
        kind: 'command',
        id: 'c1',
        targetCapability: 'local.webhook',
        action: 'request',
        sensitiveFields: ['url'],
        input: { url: 'https://example.com', body: '' },
      },
    ],
    active: true,
    dryRun: false,
    executionTarget: 'device',
    createdAt: '2026-11-27T16:00:00.000Z',
  };

  it('hides untrusted event tokens for sensitive fields like Webhook URL', () => {
    render(
      <PipelineEditor
        initialFlow={webhookFlow}
        capabilities={capabilities}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onDryRun={(draft, ev) => executeFlow({ ...draft, dryRun: true }, ev).trace}
      />,
    );

    expect(screen.getByText('Trusted tokens only')).toBeInTheDocument();
    // Trusted token appears for both URL and Body, untrusted event.payload appears only for non-sensitive fields
    const trustedPills = screen.getAllByText('+time.iso');
    const untrustedPills = screen.getAllByText('+event.payload');
    expect(trustedPills.length).toBeGreaterThan(untrustedPills.length);
  });

  it('runs Live Dry-Run simulator and displays step trace status', () => {
    render(
      <PipelineEditor
        initialFlow={webhookFlow}
        capabilities={capabilities}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onDryRun={(draft, ev) => executeFlow({ ...draft, dryRun: true }, ev).trace}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Dry Run/i }));
    expect(screen.getByText('Live Dry-Run Simulator')).toBeInTheDocument();
    expect(screen.getByText(/Would run local\.webhook\.request/)).toBeInTheDocument();
  });
});
