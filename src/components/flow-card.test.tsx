import { render } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Globe } from 'lucide-react';
import { FlowCard } from './flow-card';

/**
 * Documents *why* network records are validated before they reach the UI
 * (see `@/lib/flow-schema`): this card cannot survive a malformed flow, so an
 * unvalidated record from anyone the user follows would take down the whole
 * Discover list, not just its own card.
 */
describe('FlowCard with malformed input', () => {
  afterEach(() => vi.restoreAllMocks());

  const renderWith = (props: Partial<Parameters<typeof FlowCard>[0]>) => {
    // React logs the thrown error; keep the test output readable.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    return render(
      <FlowCard
        icon={Globe}
        triggerType={'NATIVE_BATTERY'}
        title="A flow"
        subtitle="by someone"
        actions={[{ type: 'LOG', details: {} }]}
        footer={null}
        {...props}
      />,
    );
  };

  it('renders a well-formed flow', () => {
    expect(() => renderWith({})).not.toThrow();
  });

  it('throws when the trigger type is missing', () => {
    expect(() => renderWith({ triggerType: undefined as never })).toThrow();
  });

  it('throws when actions is not an array', () => {
    expect(() => renderWith({ actions: undefined as never })).toThrow();
  });
});
