import { describe, it, expect } from 'vitest';
import {
  sanitizeForRecipeExport,
  instantiateRecipe,
  extractParametersFromRecipe,
  validateRecipeSafety,
} from './recipe';
import { templateString } from '@/services/actions';
import type { Flow, FlowRecipe } from '@/types';

describe('Recipe & Instance Separation', () => {
  const sampleFlow: Flow = {
    id: 'flow-uuid-1234',
    name: 'Discord Battery Alert',
    description: 'Alert Discord channel when battery is critically low',
    enabled: true,
    securityKey: 'super-secret-key',
    scope: 'local',
    tags: ['battery', 'discord'],
    secrets: {
      discord_webhook: 'https://discord.com/api/webhooks/123/token_secret',
      api_key: 'sk_live_12345678',
    },
    trigger: {
      type: 'NATIVE_BATTERY',
      details: { level: 0.15, charging: false },
    },
    actions: [
      {
        type: 'WEBHOOK',
        details: {
          url: '{{secrets.discord_webhook}}',
          method: 'POST',
          headers: { Authorization: 'Bearer {{secrets.api_key}}' },
          body: JSON.stringify({ content: 'Battery is at {{params.threshold}}% on {{device.name}}' }),
        },
      },
    ],
  };

  describe('extractParametersFromRecipe', () => {
    it('detects both params and secrets from trigger and action details', () => {
      const params = extractParametersFromRecipe(sampleFlow);
      const keys = params.map((p) => p.key);

      expect(keys).toContain('discord_webhook');
      expect(keys).toContain('api_key');
      expect(keys).toContain('threshold');

      const webhookParam = params.find((p) => p.key === 'discord_webhook');
      expect(webhookParam?.type).toBe('secret');

      const thresholdParam = params.find((p) => p.key === 'threshold');
      expect(thresholdParam?.type).toBe('string');
    });
  });

  describe('sanitizeForRecipeExport', () => {
    it('strips private IDs, security keys, and secrets from exported recipe', () => {
      const recipe = sanitizeForRecipeExport(sampleFlow, {
        visibility: 'public',
        tags: ['battery', 'utility'],
      });

      expect((recipe as any).id).toBeUndefined();
      expect((recipe as any).securityKey).toBeUndefined();
      expect((recipe as any).secrets).toBeUndefined();
      expect(recipe.visibility).toBe('public');
      expect(recipe.tags).toEqual(['battery', 'utility']);
      expect(recipe.parameters?.length).toBeGreaterThan(0);
      expect(recipe.name).toBe('Discord Battery Alert');

      // Make sure the original flow was not mutated
      expect(sampleFlow.secrets).toBeDefined();
      expect(sampleFlow.id).toBe('flow-uuid-1234');
    });
  });

  describe('instantiateRecipe', () => {
    it('binds values and secrets into a runnable flow instance', () => {
      const recipe: FlowRecipe = {
        name: 'Generic Webhook Alert',
        description: 'Post to an external endpoint',
        trigger: {
          type: 'NATIVE_BATTERY',
          details: { level: 0.2, charging: false },
        },
        actions: [
          {
            type: 'WEBHOOK',
            details: {
              url: 'https://example.com/alerts?token={{params.token}}',
              body: 'Battery {{params.msg}}',
            },
          },
        ],
      };

      const instance = instantiateRecipe(recipe, {
        name: 'My Custom Webhook',
        values: { token: 'my-token-val', msg: 'running low' },
        secrets: { private_credential: 'xyz' },
        scope: 'space',
        spaceId: 'did:plc:space123',
      });

      expect(instance.name).toBe('My Custom Webhook');
      expect(instance.scope).toBe('space');
      expect(instance.spaceId).toBe('did:plc:space123');
      expect(instance.secrets).toEqual({ private_credential: 'xyz' });
      expect((instance.actions[0].details as any).url).toBe('https://example.com/alerts?token=my-token-val');
      expect((instance.actions[0].details as any).body).toBe('Battery running low');
    });
  });

  describe('validateRecipeSafety', () => {
    it('warns when hardcoded tokens or webhooks are present', () => {
      const unsafeFlow = {
        trigger: { type: 'MANUAL' as const, details: {} },
        actions: [
          {
            type: 'WEBHOOK' as const,
            details: {
              url: 'https://discord.com/api/webhooks/999999/AbCdEfGhIjKlMnOpQrStUvWxYz',
              headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1Ni...' },
            },
          },
        ],
      };

      const result = validateRecipeSafety(unsafeFlow);
      expect(result.safe).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('passes clean parameterized flows', () => {
      const safeFlow = {
        trigger: { type: 'MANUAL' as const, details: {} },
        actions: [
          {
            type: 'WEBHOOK' as const,
            details: {
              url: '{{secrets.webhook_url}}',
              headers: { Authorization: 'Bearer {{secrets.token}}' },
            },
          },
        ],
      };

      const result = validateRecipeSafety(safeFlow);
      expect(result.safe).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('templateString with dot-notation and secrets', () => {
    it('resolves direct and nested values', () => {
      const context = {
        level: 0.15,
        charging: false,
        secrets: {
          bot_token: 'secret_123',
        },
        device: {
          model: 'Pixel 9',
        },
      };

      const template = 'Battery is {{level}} (charging: {{charging}}), token: {{secrets.bot_token}}, device: {{device.model}}';
      const rendered = templateString(template, context);

      expect(rendered).toBe('Battery is 0.15 (charging: false), token: secret_123, device: Pixel 9');
    });

    it('leaves unmatched placeholders intact', () => {
      const rendered = templateString('Hello {{unknown.field}}!', {});
      expect(rendered).toBe('Hello {{unknown.field}}!');
    });
  });
});
