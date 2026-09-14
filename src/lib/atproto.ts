import type { BrowserOAuthClient, OAuthClientMetadataInput } from '@atproto/oauth-client-browser';

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

let clientPromise: Promise<BrowserOAuthClient> | null = null;

/**
 * Loads `@atproto/oauth-client-browser` on demand and returns the singleton.
 *
 * The AT Protocol client is ~1.1 MB raw / ~242 kB gzip — larger than React and
 * the rest of the app combined — so it is deliberately kept off the initial
 * load path. Only call this once you know a session is actually in play; see
 * `hasOAuthSessionToRestore()` and `bootedOnOAuthCallback()` for the cheap
 * checks that decide that without importing anything.
 */
export function getOAuthClient(): Promise<BrowserOAuthClient> {
  if (!clientPromise) {
    const pending = import('@atproto/oauth-client-browser').then(
      ({ BrowserOAuthClient }) =>
        new BrowserOAuthClient({
          clientMetadata,
          // Use Bluesky's public API for handle resolution.
          // This avoids needing a custom backend worker.
          handleResolver: 'https://bsky.social',
        }),
    );
    // A failed chunk fetch (flaky network, stale service worker) shouldn't
    // poison the singleton — drop it so the next call retries.
    pending.catch(() => {
      if (clientPromise === pending) clientPromise = null;
    });
    clientPromise = pending;
  }
  return clientPromise;
}

/**
 * The URL the app booted with, captured at module evaluation — before React
 * mounts and before any router navigation can rewrite it.
 */
const BOOT_HREF = typeof window !== 'undefined' ? window.location.href : '';

/**
 * Whether a URL carries an OAuth response.
 *
 * Mirrors `BrowserOAuthClient.readCallbackParams()`. The client's `responseMode`
 * defaults to `'fragment'` and we don't override it, so the real params arrive
 * in the hash — but we check the query string too, so this keeps working if
 * that default is ever changed. A false positive only costs one needless chunk
 * fetch; a false negative would break sign-in, so err toward checking.
 */
function hasCallbackParams(href: string): boolean {
  if (!href) return false;
  const url = new URL(href);
  for (const source of [url.hash.slice(1), url.search]) {
    const params = new URLSearchParams(source);
    if (params.has('state') && (params.has('code') || params.has('error'))) {
      return true;
    }
  }
  return false;
}

/**
 * Whether this page load is an OAuth redirect coming back from the PDS.
 *
 * Read from the boot URL rather than the live one: the client matches
 * `location.pathname` against the registered `redirect_uris`, so once the
 * router leaves `/oauth/callback` the live URL no longer tells the truth.
 */
export function bootedOnOAuthCallback(): boolean {
  return hasCallbackParams(BOOT_HREF);
}

/**
 * Key `BrowserOAuthClient` uses to remember which account to restore.
 *
 * This is the library's internal storage key, so it could change on upgrade.
 * It is only ever a *secondary* signal — `useAuthStore.did` is the primary one —
 * and the failure mode if it drifts is benign: a user whose persisted store was
 * cleared but whose OAuth session survived would have to sign in again.
 */
const OAUTH_SUB_KEY = '@@atproto/oauth-client-browser(sub)';

/** Whether there is a stored session worth loading the client to restore. */
export function hasOAuthSessionToRestore(): boolean {
  try {
    return localStorage.getItem(OAUTH_SUB_KEY) !== null;
  } catch {
    // Storage can throw in private mode / with cookies blocked.
    return false;
  }
}
