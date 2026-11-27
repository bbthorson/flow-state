export * from './hub-engine';

/**
 * Cloudflare Worker HTTP router for the optional Flow State Hub.
 *
 * Mounts under `/hub/*` alongside static PWA assets in `wrangler.jsonc`:
 *   - POST /hub/e/:senderToken     — External HTTPS event ingress
 *   - GET  /hub/health             — Liveness check
 *
 * Confidential ATProto OAuth (`@bbthorson/atproto-cf-auth`) binds here when
 * Spaces OAuth scopes are enabled.
 */
export async function handleHubRequest(
  request: Request,
  resolveUserHub: (senderToken: string) => Promise<import('./hub-engine').UserHubEngine | null>,
): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === 'GET' && url.pathname === '/hub/health') {
    return Response.json({ ok: true, service: 'flow-state-hub' });
  }

  const ingressMatch = url.pathname.match(/^\/hub\/e\/([^/]+)$/);
  if (request.method === 'POST' && ingressMatch) {
    const token = decodeURIComponent(ingressMatch[1]!);
    const hub = await resolveUserHub(token);
    if (!hub) {
      return Response.json({ error: 'Unknown sender token' }, { status: 401 });
    }
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const res = await hub.handleHttpsIngress(token, body);
    return Response.json(res, { status: res.status });
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}
