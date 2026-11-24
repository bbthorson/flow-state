import { describe, it, expect } from 'vitest';
import { STARTER_FLOWS } from './templates';
import { parseRecipe } from './flow-schema';

describe('STARTER_FLOWS', () => {
  it('should be an array of flow templates', () => {
    expect(Array.isArray(STARTER_FLOWS)).toBe(true);
    expect(STARTER_FLOWS.length).toBeGreaterThan(0);
  });

  it.each(STARTER_FLOWS.map((t) => [t.name, t] as const))('%s is a valid v2 flow without an id', (_name, template) => {
    expect(typeof template.active).toBe('boolean');
    expect(typeof template.dryRun).toBe('boolean');
    expect(template.steps.length).toBeGreaterThan(0);
    const parsed = parseRecipe(template);
    expect(parsed.ok, parsed.ok ? '' : parsed.reason).toBe(true);
    // Templates should NOT have IDs as they are generated on installation
    expect((template as { id?: string }).id).toBeUndefined();
  });

  it('gives every step a unique id', () => {
    const ids = STARTER_FLOWS.flatMap((t) => t.steps.map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should include specific recommended starters', () => {
    const names = STARTER_FLOWS.map((f) => f.name);
    expect(names).toContain('Low Battery Alert');
    expect(names).toContain('Home WiFi Connect');
    expect(names).toContain('Manual Webhook Ping');
  });
});
