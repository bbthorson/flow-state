import { describe, expect, it, vi } from 'vite-plus/test';
import { resolveAppCapability } from './atproto-http';

describe('@flowstate/adapters — resolveAppCapability', () => {
  it('resolves a handle to a DID and loads a published app.flowstate.capability manifest', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('resolveHandle')) {
        return new Response(JSON.stringify({ did: 'did:plc:linear123' }), { status: 200 });
      }
      if (url.includes('listRecords')) {
        return new Response(
          JSON.stringify({
            records: [
              {
                value: {
                  name: 'Linear Bridge',
                  kind: 'bridge',
                  emits: [{ type: 'linear.issue.assigned', label: 'Issue Assigned', fields: [] }],
                  accepts: [
                    {
                      action: 'createIssue',
                      label: 'Create Issue',
                      inputs: [{ name: 'title', label: 'Title', type: 'string', required: true }],
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response('not found', { status: 404 });
    });

    const res = await resolveAppCapability('@linear.bridge.app', undefined, fetchMock as unknown as typeof fetch);
    expect(res.did).toBe('did:plc:linear123');
    expect(res.handle).toBe('linear.bridge.app');
    expect(res.fromNetwork).toBe(true);
    expect(res.capability.name).toBe('Linear Bridge');
    expect(res.capability.accepts[0]?.action).toBe('createIssue');
  });

  it('falls back cleanly to a default capability stub when no manifest record is published', async () => {
    const fetchMock = vi.fn(async () => new Response('not found', { status: 404 }));
    const res = await resolveAppCapability('did:plc:customapp', 'Custom App', fetchMock as unknown as typeof fetch);
    expect(res.did).toBe('did:plc:customapp');
    expect(res.fromNetwork).toBe(false);
    expect(res.capability.name).toBe('Custom App');
  });
});
