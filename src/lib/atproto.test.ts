import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * `bootedOnOAuthCallback()` reads a URL captured at module evaluation, so each
 * case has to set the location and then re-import the module fresh.
 */
async function bootAt(href: string): Promise<boolean> {
  vi.resetModules();
  Object.defineProperty(window, 'location', {
    value: new URL(href),
    writable: true,
    configurable: true,
  });
  const { bootedOnOAuthCallback } = await import('./atproto');
  return bootedOnOAuthCallback();
}

const ORIGINAL_LOCATION = window.location;

describe('bootedOnOAuthCallback', () => {
  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: ORIGINAL_LOCATION,
      writable: true,
      configurable: true,
    });
    vi.resetModules();
  });

  it('detects a callback in the fragment (the client default)', async () => {
    expect(
      await bootAt('https://example.com/oauth/callback#state=abc&code=xyz'),
    ).toBe(true);
  });

  it('detects an error response in the fragment', async () => {
    expect(
      await bootAt('https://example.com/oauth/callback#state=abc&error=access_denied'),
    ).toBe(true);
  });

  it('detects a callback in the query string too', async () => {
    // Guards against responseMode being switched to 'query' later.
    expect(
      await bootAt('https://example.com/oauth/callback?state=abc&code=xyz'),
    ).toBe(true);
  });

  it('ignores a plain app load', async () => {
    expect(await bootAt('https://example.com/')).toBe(false);
  });

  it('ignores a deep-link trigger that is not an OAuth response', async () => {
    expect(
      await bootAt('https://example.com/?event=battery_low&secret=shh'),
    ).toBe(false);
  });

  it('requires both state and code/error, not just state', async () => {
    expect(await bootAt('https://example.com/#state=abc')).toBe(false);
  });
});

describe('hasOAuthSessionToRestore', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it('is false with no stored session', async () => {
    const { hasOAuthSessionToRestore } = await import('./atproto');
    expect(hasOAuthSessionToRestore()).toBe(false);
  });

  it('is true once the client has stored a subject', async () => {
    localStorage.setItem('@@atproto/oauth-client-browser(sub)', 'did:plc:abc123');
    const { hasOAuthSessionToRestore } = await import('./atproto');
    expect(hasOAuthSessionToRestore()).toBe(true);
  });

  it('is false rather than throwing when storage is unavailable', async () => {
    // Spy on the localStorage object itself: the test setup replaces it with a
    // plain stub, so it is not a Storage instance and prototype spies miss it.
    const getItem = vi
      .spyOn(window.localStorage, 'getItem')
      .mockImplementation(() => {
        throw new Error('SecurityError');
      });
    const { hasOAuthSessionToRestore } = await import('./atproto');

    expect(() => window.localStorage.getItem('probe')).toThrow(); // spy is live
    expect(hasOAuthSessionToRestore()).toBe(false);

    getItem.mockRestore();
  });
});
