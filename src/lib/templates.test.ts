import { describe, it, expect } from 'vitest';
import { STARTER_FLOWS } from './templates';

describe('STARTER_FLOWS', () => {
  it('should be an array of flow templates', () => {
    expect(Array.isArray(STARTER_FLOWS)).toBe(true);
    expect(STARTER_FLOWS.length).toBeGreaterThan(0);
  });

  it('should have valid flow structures without IDs', () => {
    STARTER_FLOWS.forEach(template => {
      expect(template.name).toBeDefined();
      expect(typeof template.enabled).toBe('boolean');
      expect(template.trigger).toBeDefined();
      expect(template.trigger.type).toBeDefined();
      expect(template.trigger.details).toBeDefined();
      expect(Array.isArray(template.actions)).toBe(true);
      
      template.actions.forEach(action => {
        expect(action.type).toBeDefined();
        expect(action.details).toBeDefined();
      });

      // Templates should NOT have IDs as they are generated on installation
      expect((template as any).id).toBeUndefined();
    });
  });

  it('should include specific recommended starters', () => {
    const names = STARTER_FLOWS.map(f => f.name);
    expect(names).toContain('Low Battery Alert');
    expect(names).toContain('Home WiFi Connect');
    expect(names).toContain('Siri Shortcut Trigger');
  });
});
