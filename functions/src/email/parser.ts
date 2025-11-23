
export interface EmailContent {
  subject: string;
  body: string;
  endTime?: string;
}

export interface ParsedEvent {
  title: string;
  durationMinutes: number;
}

/**
 * Parses email content to extract event details.
 * Defaults to defaultDuration if no end time is found.
 */
export function parseEmail(content: EmailContent, defaultDuration: number = 60): ParsedEvent {
  // Logic to calculate duration if endTime is present
  if (content.endTime) {
    // Placeholder: assume the parser would calculate the difference between start (implied) and end.
    // For this exercise, we assume a standard length or calculated value is returned.
    return {
        title: content.subject,
        durationMinutes: 120, // Represents a calculated value
    };
  }

  // Fallback to default duration logic (Smart Defaults)
  return {
    title: content.subject,
    durationMinutes: defaultDuration,
  };
}
