import type { RunData } from './primitives';

const PLACEHOLDER_RE = /\{\{\s*([^}]+?)\s*\}\}/g;

/** Safely traverse a dot-separated path into an object. */
export function getPath(data: RunData, path: string): unknown {
  let current: unknown = data;
  for (const part of path.split('.')) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/** Format a scalar value for template interpolation without `[object Object]`. */
export function formatScalar(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

/** Return the root segment of every `{{...}}` placeholder in a template string. */
export function extractPlaceholderRoots(template: string): string[] {
  const roots: string[] = [];
  for (const match of template.matchAll(PLACEHOLDER_RE)) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    const root = raw.split('.')[0];
    if (root) roots.push(root);
  }
  return roots;
}

/** Extract referenced `secrets.<name>` keys from a template string. */
export function extractSecretKeys(template: string): string[] {
  const keys: string[] = [];
  for (const match of template.matchAll(PLACEHOLDER_RE)) {
    const raw = match[1]?.trim();
    if (raw?.startsWith('secrets.')) {
      const key = raw.slice('secrets.'.length).trim();
      if (key) keys.push(key);
    }
  }
  return keys;
}

/**
 * Check whether every placeholder in `template` comes from a trusted root.
 * `secrets` is always considered a trusted root (device-owned Tier-0 data).
 */
export function isTemplateTrusted(template: string, trustedRoots: ReadonlySet<string>): boolean {
  const roots = extractPlaceholderRoots(template);
  return roots.every((root) => root === 'secrets' || trustedRoots.has(root));
}

export interface RenderResult {
  ok: true;
  value: string;
  secretKeys: string[];
}

export interface RenderBlocked {
  ok: false;
  reason: string;
  untrustedRoots: string[];
}

/**
 * Render a template string against `data`.
 *
 * - `secrets.<key>` placeholders are preserved verbatim in the rendered output
 *   and returned in `secretKeys` so secrets are NEVER materialized into
 *   Command payloads, Checkpoints, or RunTraces — only resolved at adapter
 *   dispatch time from the Tier-0 vault.
 * - When `requireTrusted` is true (sensitive sinks like Webhook URLs/headers),
 *   any placeholder referencing an untrusted root is rejected.
 */
export function renderTemplate(
  template: string,
  data: RunData,
  trustedRoots: ReadonlySet<string>,
  options?: { requireTrusted?: boolean },
): RenderResult | RenderBlocked {
  const roots = extractPlaceholderRoots(template);
  if (options?.requireTrusted) {
    const untrusted = roots.filter((r) => r !== 'secrets' && !trustedRoots.has(r));
    if (untrusted.length > 0) {
      return {
        ok: false,
        reason: `Untrusted data (${untrusted.join(', ')}) cannot be interpolated into a sensitive field.`,
        untrustedRoots: untrusted,
      };
    }
  }

  const secretKeys: string[] = [];
  const value = template.replace(PLACEHOLDER_RE, (full, expr: string) => {
    const trimmed = expr.trim();
    if (trimmed.startsWith('secrets.')) {
      const key = trimmed.slice('secrets.'.length).trim();
      if (key) secretKeys.push(key);
      // Keep placeholder intact for Tier-0 resolution at dispatch time
      return full;
    }
    const resolved = getPath(data, trimmed);
    return formatScalar(resolved);
  });

  return { ok: true, value, secretKeys };
}

/**
 * Resolve `{{secrets.<key>}}` placeholders using a Tier-0 secret lookup function.
 * Called ONLY inside a CommandAdapter at the moment of dispatch.
 */
export function materializeSecrets(
  template: string,
  resolveSecret: (key: string) => string | undefined,
): { ok: true; value: string } | { ok: false; missingKeys: string[] } {
  const missingKeys: string[] = [];
  const value = template.replace(PLACEHOLDER_RE, (full, expr: string) => {
    const trimmed = expr.trim();
    if (!trimmed.startsWith('secrets.')) return full;
    const key = trimmed.slice('secrets.'.length).trim();
    const secret = resolveSecret(key);
    if (secret === undefined) {
      missingKeys.push(key);
      return '';
    }
    return secret;
  });
  if (missingKeys.length > 0) {
    return { ok: false, missingKeys };
  }
  return { ok: true, value };
}
