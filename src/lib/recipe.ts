import type {
  Flow,
  FlowRecipe,
  FlowParameterDefinition,
  FlowScope,
  FlowVisibility,
} from '@/types';

/** Regex to match template parameter tags: {{params.key}} or {{secrets.key}} */
const PARAM_REGEX = /\{\{\s*(params|secrets)\.([a-zA-Z0-9_-]+)\s*\}\}/g;

/** Known patterns indicating a hardcoded secret or token that shouldn't be published */
const SENSITIVE_PATTERNS = [
  /bearer\s+[a-zA-Z0-9._~+/-]+=*/i,
  /basic\s+[a-zA-Z0-9+/=]+/i,
  /api[_-]?key["':\s=]+[a-zA-Z0-9_-]{8,}/i,
  /token["':\s=]+[a-zA-Z0-9_-]{8,}/i,
  /https:\/\/discord\.com\/api\/webhooks\/\d+\/[a-zA-Z0-9_-]+/i,
  /https:\/\/hooks\.slack\.com\/services\/[a-zA-Z0-9_/]+/i,
  /https:\/\/maker\.ifttt\.com\/trigger\/[a-zA-Z0-9_-]+\/with\/key\/[a-zA-Z0-9_-]+/i,
];

/**
 * Scan a flow or string for potential hardcoded sensitive credentials.
 * Used as a pre-flight safety check before publishing to public ATProto repos.
 */
export function validateRecipeSafety(flow: Pick<Flow, 'trigger' | 'actions'>): {
  safe: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  const serialized = JSON.stringify({ trigger: flow.trigger, actions: flow.actions });

  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(serialized)) {
      warnings.push(
        `Potential hardcoded credential or private webhook URL detected matching: ${pattern.source.slice(0, 30)}...`,
      );
    }
  }

  return {
    safe: warnings.length === 0,
    warnings,
  };
}

/**
 * Extract all `{{params.XYZ}}` and `{{secrets.XYZ}}` references across trigger and action details.
 */
export function extractParametersFromRecipe(
  recipe: Pick<FlowRecipe, 'trigger' | 'actions'>,
): FlowParameterDefinition[] {
  const foundKeys = new Map<string, 'string' | 'secret'>();
  const serialized = JSON.stringify({ trigger: recipe.trigger, actions: recipe.actions });

  let match: RegExpExecArray | null;
  while ((match = PARAM_REGEX.exec(serialized)) !== null) {
    const kind = match[1] === 'secrets' ? 'secret' : 'string';
    const key = match[2];
    if (!foundKeys.has(key) || kind === 'secret') {
      foundKeys.set(key, kind);
    }
  }

  const defs: FlowParameterDefinition[] = [];
  for (const [key, type] of foundKeys.entries()) {
    defs.push({
      key,
      label: key.replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      type,
      required: true,
    });
  }

  return defs;
}

/**
 * Sanitize a local or space Flow into a public/shared Recipe.
 *
 * Enforces the trust & privacy boundary:
 * - Strips internal `id`, `securityKey`, and `secrets` dictionary.
 * - Deep clones details so mutations do not affect the local instance.
 * - Auto-extracts parameter definitions if not already declared.
 */
export function sanitizeForRecipeExport(
  flow: Flow,
  options?: {
    visibility?: FlowVisibility;
    tags?: string[];
    description?: string;
  },
): FlowRecipe {
  // Deep clone trigger and actions without any secrets or local IDs
  const triggerCopy = JSON.parse(JSON.stringify(flow.trigger));
  const actionsCopy = JSON.parse(JSON.stringify(flow.actions));

  const inferredParameters = extractParametersFromRecipe({
    trigger: triggerCopy,
    actions: actionsCopy,
  });

  const mergedParams = [
    ...(flow.parameters ?? []),
    ...inferredParameters.filter((p) => !flow.parameters?.some((existing) => existing.key === p.key)),
  ];

  return {
    name: flow.name,
    description: options?.description ?? flow.description,
    tags: options?.tags ?? flow.tags,
    forkedFromUri: flow.forkedFromUri,
    visibility: options?.visibility ?? 'public',
    parameters: mergedParams.length > 0 ? mergedParams : undefined,
    trigger: triggerCopy,
    actions: actionsCopy,
  };
}

/**
 * Interpolate values recursively within an object or string.
 */
function interpolateObject<T>(obj: T, lookup: (kind: string, key: string) => string | undefined): T {
  if (typeof obj === 'string') {
    return obj.replace(PARAM_REGEX, (match, kind, key) => {
      const val = lookup(kind, key);
      return val !== undefined ? String(val) : match;
    }) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => interpolateObject(item, lookup)) as unknown as T;
  }

  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = interpolateObject(v, lookup);
    }
    return result as T;
  }

  return obj;
}

/**
 * Instantiate a FlowRecipe into an executable Flow (local or ATProto Space).
 *
 * Parameters and secrets provided at install time are bound:
 * - `values` are interpolated into `{{params.XYZ}}` placeholders.
 * - `secrets` are stored securely in `flow.secrets` (for dynamic runtime injection)
 *   and/or substituted into `{{secrets.XYZ}}`.
 */
export function instantiateRecipe(
  recipe: FlowRecipe,
  options?: {
    values?: Record<string, unknown>;
    secrets?: Record<string, string>;
    scope?: FlowScope;
    spaceId?: string;
    enabled?: boolean;
    name?: string;
  },
): Omit<Flow, 'id'> {
  const values = options?.values ?? {};
  const secrets = options?.secrets ?? {};

  const lookup = (kind: string, key: string): string | undefined => {
    if (kind === 'secrets') {
      return secrets[key];
    }
    const val = values[key];
    return val !== undefined ? String(val) : undefined;
  };

  const boundTrigger = interpolateObject(recipe.trigger, lookup);
  const boundActions = interpolateObject(recipe.actions, lookup);

  return {
    name: options?.name ?? recipe.name,
    description: recipe.description,
    enabled: options?.enabled ?? false,
    forkedFromUri: recipe.id ?? recipe.forkedFromUri,
    scope: options?.scope ?? 'local',
    spaceId: options?.spaceId,
    tags: recipe.tags,
    parameters: recipe.parameters,
    secrets: Object.keys(secrets).length > 0 ? secrets : undefined,
    trigger: boundTrigger,
    actions: boundActions,
  };
}
