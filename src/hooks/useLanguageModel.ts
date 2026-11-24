import { extractJson, normalizeGeneratedFlow, type GeneratedFlow } from '@/lib/generated-flow';
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

const SYSTEM_PROMPT = `You are a Flow State automation assistant. Given a natural language description, generate a JSON flow.

A flow has one trigger and a list of steps that run in order.

Trigger types and their details:
- NATIVE_BATTERY: { charging?: boolean, level?: number (0-1) } — fires on entering that state, e.g. unplugged at or below 20%
- NETWORK: { online: boolean }
- GEOLOCATION: { latitude: number, longitude: number, radius: number (meters), event: "ENTER" | "EXIT" }
- DEEP_LINK: { event: string }
- MANUAL: {}
- IDLE: { threshold: number (ms, min 60000), detectScreen: boolean }
- DEVICE_MOTION: { gesture: "SHAKE" | "FACE_DOWN" | "FACE_UP" }
- SCREEN_ORIENTATION: { orientation: "portrait" | "landscape" }
- TIME: { time: "HH:MM" (24-hour), days?: number[] (0=Sunday..6) }
- EVENT: { event: string } — another flow emitted this event

Step types:
- Action: { "type": "action", "action": { "type": ACTION_TYPE, "details": { ... } } }
- Condition (stops the run unless it holds): { "type": "condition", "assertions": [{ "field": "...", "operator": "eq|neq|gt|gte|lt|lte|contains", "value": "..." }] }

Action types and their details:
- NOTIFICATION: { title: string, body?: string }
- WEBHOOK: { url: string, method?: string, body?: string }
- LOG: { message?: string }
- VIBRATION: { duration?: number (ms) }
- CLIPBOARD: { text: string }
- WEB_SHARE: { title?: string, text?: string, url?: string }
- WAKE_LOCK: { duration?: number (ms) }
- SPEECH: { text: string }
- EMIT_EVENT: { event: string, title?: string }

Condition fields: time.hour (0-23), time.weekday (0=Sunday), device.battery.level (0-1), device.battery.charging (true/false), device.network.online, or trigger.<key>.
Text can use {{trigger.<key>}}, {{time.hour}}, {{device.battery.level}}. Never put {{...}} in a webhook URL.

Example — "When I shake my phone during the day, share a note":
{"name":"Shake to share","trigger":{"type":"DEVICE_MOTION","details":{"gesture":"SHAKE"}},"steps":[{"type":"condition","assertions":[{"field":"time.hour","operator":"gte","value":"8"},{"field":"time.hour","operator":"lt","value":"22"}]},{"type":"action","action":{"type":"WEB_SHARE","details":{"text":"Check this out"}}}]}

Respond with ONLY valid JSON: { "name": string, "trigger": { "type", "details" }, "steps": [ ... ] }`;

export async function generateFlow(description: string): Promise<GeneratedFlow | null> {
  try {
    if (!('LanguageModel' in window)) return null;

    const session = await (window as any).LanguageModel.create({
      initialPrompts: [{ role: 'system', content: SYSTEM_PROMPT }],
    });

    const result = await session.prompt(description);
    session.destroy();

    return normalizeGeneratedFlow(extractJson(result));
  } catch {
    return null;
  }
}
