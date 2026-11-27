import { parseCapability, type Capability } from '@flowstate/core';

const PUBLIC_BSKY_API = 'https://public.api.bsky.app';

export interface ResolvedParticipant {
  did: string;
  handle?: string;
  capability: Capability;
  fromNetwork: boolean;
}

/**
 * Resolve a Bluesky handle (e.g. `linear-bridge.app`) or raw DID (`did:plc:...`)
 * to a DID using the public AT Protocol identity endpoint.
 */
export async function resolveAtProtoIdentity(
  handleOrDid: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<{ did: string; handle?: string }> {
  const trimmed = handleOrDid.trim().replace(/^@/, '');
  if (trimmed.startsWith('did:')) {
    return { did: trimmed };
  }
  const url = `${PUBLIC_BSKY_API}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(trimmed)}`;
  const res = await fetchImpl(url);
  if (!res.ok) {
    throw new Error(`Could not resolve handle "${trimmed}" (${res.status})`);
  }
  const data = (await res.json()) as { did?: string };
  if (!data.did) {
    throw new Error(`No DID returned for handle "${trimmed}"`);
  }
  return { did: data.did, handle: trimmed };
}

/**
 * Fetch and Zod-validate an invited App or Bridge DID's `app.flowstate.capability`
 * manifest from the AT Protocol network.
 *
 * Falls back gracefully to a minimal event/command capability stub if the DID
 * hasn't published a manifest record yet.
 */
export async function resolveAppCapability(
  handleOrDid: string,
  label?: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<ResolvedParticipant> {
  const { did, handle } = await resolveAtProtoIdentity(handleOrDid, fetchImpl);
  const displayName = label?.trim() || handle || did;

  try {
    const url = `${PUBLIC_BSKY_API}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(did)}&collection=app.flowstate.capability&limit=1`;
    const res = await fetchImpl(url);
    if (res.ok) {
      const json = (await res.json()) as { records?: Array<{ value?: unknown }> };
      const raw = json.records?.[0]?.value;
      if (raw && typeof raw === 'object') {
        const parsed = parseCapability({
          id: did,
          did,
          runtimes: ['remote-did'],
          permissions: [],
          ...(raw as Record<string, unknown>),
        });
        if (parsed.ok) {
          return { did, handle, capability: parsed.data, fromNetwork: true };
        }
      }
    }
  } catch {
    // Fall through to default capability stub when offline or unpublished
  }

  return {
    did,
    handle,
    fromNetwork: false,
    capability: {
      id: did,
      kind: 'app',
      name: displayName,
      did,
      emits: [{ type: `${did}.event`, label: 'App Event', fields: [] }],
      accepts: [
        {
          action: 'dispatch',
          label: 'Send Command',
          inputs: [{ name: 'payload', label: 'Payload', type: 'string' }],
        },
      ],
      runtimes: ['remote-did'],
      permissions: [],
    },
  };
}
