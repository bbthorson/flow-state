import { describe, it, expect } from 'vitest';
import { sanitizeForRecipeExport, instantiateRecipe, recipeBlanks, validateRecipeSafety } from './recipe';
import { templateString } from '@/services/actions';
import type { Flow, FlowRecipe } from '@/types';

describe('Recipe & Instance Separation', () => {
  const sampleFlow: Flow = {
    id: 'flow-uuid-1234',
    name: 'Discord Battery Alert',
    description: 'Alert Discord channel when battery is critically low',
    active: true,
    dryRun: false,
    tags: ['battery', 'discord'],
    createdAt: '2026-11-24T00:00:00.000Z',
    secrets: {
      discord_webhook: 'https://discord.com/api/webhooks/123/token_secret',
      api_key: 'sk_live_12345678',
      securityKey: 'super-secret-key',
    },
    trigger: { type: 'NATIVE_BATTERY', details: { level: 0.15, charging: false } },
    steps: [
      { type: 'variable', id: 'v1', name: 'discord_webhook', kind: 'secret', label: 'Discord webhook' },
      { type: 'variable', id: 'v2', name: 'api_key', kind: 'secret' },
      { type: 'variable', id: 'v3', name: 'threshold', value: '15', label: 'Threshold %' },
      { type: 'variable', id: 'v4', name: 'emoji', value: 'battery', preserveOnDuplication: true },
      {
        type: 'action',
        id: 'a1',
        action: {
          type: 'WEBHOOK',
          details: {
            url: '{{discord_webhook}}',
            method: 'POST',
            headers: { Authorization: 'Bearer {{api_key}}' },
            body: JSON.stringify({ content: 'Battery is at {{threshold}}%' }),
          },
        },
      },
    ],
  };

  describe('recipeBlanks', () => {
    it('asks for every secret and every variable not marked preserveOnDuplication', () => {
      expect(recipeBlanks(sampleFlow).map((v) => v.name)).toEqual(['discord_webhook', 'api_key', 'threshold']);
    });
  });

  describe('sanitizeForRecipeExport', () => {
    it('drops the local id, activation state and secrets', () => {
      const recipe = sanitizeForRecipeExport(sampleFlow);
      const serialized = JSON.stringify(recipe);

      expect(recipe).not.toHaveProperty('id');
      expect(recipe).not.toHaveProperty('secrets');
      expect(recipe).not.toHaveProperty('active');
      expect(serialized).not.toContain('super-secret-key');
      expect(serialized).not.toContain('token_secret');
      expect(serialized).not.toContain('sk_live_12345678');
      expect(recipe.steps).toHaveLength(5);
    });

    it('strips a value accidentally left on a secret variable', () => {
      const leaky: Flow = {
        ...sampleFlow,
        steps: [{ type: 'variable', id: 'v1', name: 'token', kind: 'secret', value: 'oops' }],
      };
      expect(JSON.stringify(sanitizeForRecipeExport(leaky))).not.toContain('oops');
    });
  });

  describe('instantiateRecipe', () => {
    const recipe: FlowRecipe = { ...sanitizeForRecipeExport(sampleFlow), id: 'at://did:plc:abc/app.flowstate.automation/rk' };

    it('binds values and secrets into a runnable flow instance', () => {
      const instance = instantiateRecipe(recipe, {
        values: { threshold: '10' },
        secrets: { discord_webhook: 'https://discord.com/api/webhooks/999/mine', api_key: 'k' },
      });

      expect(instance.secrets).toEqual({ discord_webhook: 'https://discord.com/api/webhooks/999/mine', api_key: 'k' });
      const threshold = instance.steps.find((s) => s.type === 'variable' && s.name === 'threshold');
      expect(threshold).toMatchObject({ value: '10' });
    });

    it('starts installs inactive and in dry run', () => {
      const instance = instantiateRecipe(recipe);
      expect(instance.active).toBe(false);
      expect(instance.dryRun).toBe(true);
    });

    it('flattens lineage to the root', () => {
      expect(instantiateRecipe(recipe).forkedFromUri).toBe(recipe.id);
      const copyOfCopy = { ...recipe, forkedFromUri: 'at://did:plc:root/app.flowstate.automation/r0' };
      expect(instantiateRecipe(copyOfCopy).forkedFromUri).toBe('at://did:plc:root/app.flowstate.automation/r0');
    });
  });

  describe('validateRecipeSafety', () => {
    it('warns when hardcoded tokens or webhooks are present', () => {
      const result = validateRecipeSafety({
        trigger: { type: 'MANUAL', details: {} },
        steps: [
          {
            type: 'action',
            id: 'a1',
            action: { type: 'WEBHOOK', details: { url: 'https://discord.com/api/webhooks/123456/abc_token_xyz' } },
          },
        ],
      });
      expect(result.safe).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('passes flows whose credentials are secret variables', () => {
      expect(validateRecipeSafety(sanitizeForRecipeExport(sampleFlow)).safe).toBe(true);
    });
  });

  describe('templateString with dot-notation', () => {
    it('resolves direct and nested values', () => {
      const rendered = templateString('URL: {{webhook}}, Level: {{trigger.level}}', {
        webhook: 'https://hooks.example.com',
        trigger: { level: 15 },
      });
      expect(rendered).toBe('URL: https://hooks.example.com, Level: 15');
    });

    it('leaves unmatched placeholders intact', () => {
      expect(templateString('Hello {{unknown.field}}!', {})).toBe('Hello {{unknown.field}}!');
    });
  });
});
