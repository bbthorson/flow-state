import { useState, useEffect } from 'react';

type Availability = 'unavailable' | 'after-download' | 'readily-available';

export function useLanguageModel() {
  const [availability, setAvailability] = useState<Availability>('unavailable');

  useEffect(() => {
    async function check() {
      try {
        if (!('LanguageModel' in window)) {
          setAvailability('unavailable');
          return;
        }
        const result = await (window as any).LanguageModel.availability();
        setAvailability(result as Availability);
      } catch {
        setAvailability('unavailable');
      }
    }
    check();
  }, []);

  return availability;
}

const SYSTEM_PROMPT = `You are a Flow State automation assistant. Given a natural language description, generate a JSON flow object.

Available trigger types and their details:
- NATIVE_BATTERY: { charging: boolean, level?: number (0-1) }
- NETWORK: { online: boolean, ssid?: string }
- GEOLOCATION: { latitude: number, longitude: number, radius: number, event: "ENTER" | "EXIT" }
- DEEP_LINK: { event: string }
- MANUAL: {}
- IDLE: { threshold: number (ms, min 60000), detectScreen: boolean }
- DEVICE_MOTION: { gesture: "SHAKE" | "FACE_DOWN" | "FACE_UP" }
- SCREEN_ORIENTATION: { orientation: "portrait" | "landscape" }

Available action types and their details:
- WEBHOOK: { url: string, method?: string, headers?: object, body?: string }
- NOTIFICATION: { title: string, body?: string }
- LOG: { message?: string }
- VIBRATION: { duration?: number (ms) }
- CLIPBOARD: { text: string }
- WEB_SHARE: { title?: string, text?: string, url?: string }
- WAKE_LOCK: { duration?: number (ms) }
- SPEECH: { text: string, rate?: number, pitch?: number, volume?: number }

Actions support {{variable}} template syntax for trigger data.

Respond with ONLY valid JSON matching this schema:
{
  "name": "string",
  "trigger": { "type": "TRIGGER_TYPE", "details": { ... } },
  "actions": [{ "type": "ACTION_TYPE", "details": { ... } }]
}`;

export async function generateFlow(description: string): Promise<{
  name: string;
  trigger: { type: string; details: Record<string, any> };
  actions: Array<{ type: string; details: Record<string, any> }>;
} | null> {
  try {
    if (!('LanguageModel' in window)) return null;

    const session = await (window as any).LanguageModel.create({
      initialPrompts: [{ role: 'system', content: SYSTEM_PROMPT }],
    });

    const result = await session.prompt(description);
    session.destroy();

    // Extract JSON from response (may be wrapped in markdown code block)
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}
