import { BrowserOAuthClient, OAuthClientMetadataInput } from '@atproto/oauth-client-browser';

const PROD_ORIGIN = 'https://flow-state.bbthorson.workers.dev';

const IS_DEV = typeof window !== 'undefined' && !window.location.origin.startsWith('https://');

// In dev, use undefined clientMetadata for loopback auto-config.
// In prod, point to the hosted client-metadata.json.
const clientMetadata: OAuthClientMetadataInput | undefined = IS_DEV
  ? undefined
  : {
      client_id: `${PROD_ORIGIN}/oauth/client-metadata.json`,
      client_name: 'Flow State',
      client_uri: PROD_ORIGIN,
      logo_uri: `${PROD_ORIGIN}/icons/icon-512x512.png`,
      redirect_uris: [`${PROD_ORIGIN}/oauth/callback`],
      scope: 'atproto transition:generic',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      application_type: 'web',
      dpop_bound_access_tokens: true,
    };

let clientInstance: BrowserOAuthClient | null = null;

export function getOAuthClient(): BrowserOAuthClient {
  if (!clientInstance) {
    clientInstance = new BrowserOAuthClient({
      clientMetadata,
      // Use Bluesky's public API for handle resolution.
      // This avoids needing a custom backend worker.
      handleResolver: 'https://bsky.social',
    });
  }
  return clientInstance;
}
