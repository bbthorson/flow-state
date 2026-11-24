import type { Flow, FlowRecipe, FlowStep, VariableStep } from '@/types';
import { variableSteps } from '@/lib/steps';

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
 * Scan a flow for hardcoded credentials before it is published. Secret
 * variables are fine — their values are never written to a record — so this
 * catches tokens typed straight into a URL, header or literal variable.
 */
export function validateRecipeSafety(flow: Pick<FlowRecipe, 'trigger' | 'steps'>): {
  safe: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  const serialized = JSON.stringify({ trigger: flow.trigger, steps: stripSecretValues(flow.steps) });

  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(serialized)) {
      warnings.push(
        `Potential hardcoded credential or private webhook URL detected matching: ${pattern.source.slice(0, 30)}...`,
      );
    }
  }

  return { safe: warnings.length === 0, warnings };
}

/** Deep copy of steps with every secret variable's value removed. */
export function stripSecretValues(steps: FlowStep[]): FlowStep[] {
  return steps.map((step): FlowStep => {
    if (step.type === 'variable' && step.kind === 'secret') {
      const { value: _value, ...rest } = step;
      return { ...rest };
    }
    if (step.type === 'condition') {
      return {
        ...step,
        ...(step.then ? { then: stripSecretValues(step.then) } : {}),
        ...(step.else ? { else: stripSecretValues(step.else) } : {}),
      };
    }
    return structuredClone(step);
  });
}

/**
 * The blanks someone installing a recipe fills in: every secret, and every
 * variable the author didn't mark `preserveOnDuplication`.
 */
export function recipeBlanks(recipe: Pick<FlowRecipe, 'steps'>): VariableStep[] {
  return variableSteps(recipe.steps).filter((v) => v.kind === 'secret' || !v.preserveOnDuplication);
}

/**
 * The shareable content of a flow. Drops the local id, activation state and
 * secrets; secret variable values are stripped (they shouldn't be set anyway).
 */
export function sanitizeForRecipeExport(flow: Flow, options?: { tags?: string[]; description?: string }): FlowRecipe {
  return {
    name: flow.name,
    description: options?.description ?? flow.description,
    tags: options?.tags ?? flow.tags,
    forkedFromUri: flow.forkedFromUri,
    trigger: structuredClone(flow.trigger),
    steps: stripSecretValues(flow.steps),
  };
}

function bindVariables(steps: FlowStep[], values: Record<string, unknown>): FlowStep[] {
  return steps.map((step): FlowStep => {
    if (step.type === 'variable' && step.kind !== 'secret' && step.name in values) {
      const value = values[step.name];
      return { ...step, value: value === undefined || value === null ? undefined : String(value) };
    }
    if (step.type === 'condition') {
      return {
        ...step,
        ...(step.then ? { then: bindVariables(step.then, values) } : {}),
        ...(step.else ? { else: bindVariables(step.else, values) } : {}),
      };
    }
    return structuredClone(step);
  });
}

/**
 * Turn a recipe into a runnable flow on this device. `values` fill non-secret
 * variables; `secrets` are kept in `flow.secrets` (device-only). New installs
 * start inactive and in dry run, so nothing fires until the owner has seen it.
 */
export function instantiateRecipe(
  recipe: FlowRecipe,
  options?: {
    values?: Record<string, unknown>;
    secrets?: Record<string, string>;
    active?: boolean;
    dryRun?: boolean;
    name?: string;
  },
): Omit<Flow, 'id'> {
  const secrets = options?.secrets ?? {};
  return {
    name: options?.name ?? recipe.name,
    description: recipe.description,
    tags: recipe.tags,
    // Flattened lineage: a copy of a copy still points at the root.
    forkedFromUri: recipe.forkedFromUri ?? recipe.id,
    active: options?.active ?? false,
    dryRun: options?.dryRun ?? true,
    trigger: structuredClone(recipe.trigger),
    steps: bindVariables(recipe.steps, options?.values ?? {}),
    ...(Object.keys(secrets).length > 0 ? { secrets } : {}),
    createdAt: new Date().toISOString(),
  };
}
