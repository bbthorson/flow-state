export interface TriggerSupport {
  battery: boolean;
  network: boolean;
  visibility: boolean;
}

export function getSupportedTriggers(): TriggerSupport {
  return {
    battery: typeof navigator !== 'undefined' && typeof (navigator as any).getBattery === 'function',
    network: typeof navigator !== 'undefined' && ('connection' in navigator || 'onLine' in navigator),
    visibility: typeof document !== 'undefined' && 'visibilityState' in document,
  };
}
