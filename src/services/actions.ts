export interface WebhookDetails {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface NotificationDetails {
  title: string;
  body?: string;
  icon?: string;
}

export interface ActionResult {
  success: boolean;
  message?: string;
}

function templateString(str: string | undefined, data: Record<string, any>): string {
  if (!str) return '';
  return str.replace(/\{\{(.*?)\}\}/g, (match, key) => {
    const value = data[key.trim()];
    return value !== undefined ? String(value) : match;
  });
}

export async function executeWebhook(details: WebhookDetails, data: Record<string, any> = {}): Promise<ActionResult> {
  try {
    const templatedUrl = templateString(details.url, data);
    const templatedBody = details.body ? templateString(details.body, data) : undefined;
    const templatedHeaders = details.headers ? JSON.parse(templateString(JSON.stringify(details.headers), data)) : undefined;

    const response = await fetch(templatedUrl, {
      method: details.method || 'POST',
      headers: templatedHeaders,
      body: templatedBody,
    });

    if (!response.ok) {
      return {
        success: false,
        message: `Webhook failed with status: ${response.status} ${response.statusText}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error during webhook execution',
    };
  }
}

export async function executeNotification(details: NotificationDetails, data: Record<string, any> = {}): Promise<ActionResult> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return { success: false, message: 'Notifications not supported in this environment' };
  }

  try {
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
      return { success: false, message: `Notification permission ${permission}` };
    }

    const templatedTitle = templateString(details.title, data);
    const templatedBody = details.body ? templateString(details.body, data) : undefined;

    new Notification(templatedTitle, {
      body: templatedBody,
      icon: details.icon,
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error during notification execution',
    };
  }
}

export async function executeVibration(
  details: { duration?: number; pattern?: number[] },
  data: Record<string, any> = {}
): Promise<ActionResult> {
  try {
    if (!navigator.vibrate) {
      return { success: false, message: 'Vibration API not supported in this environment' };
    }

    const vibrationInput = details.pattern ? details.pattern : (details.duration || 200);
    navigator.vibrate(vibrationInput);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error during vibration execution',
    };
  }
}

export async function executeClipboard(
  details: { text: string },
  data: Record<string, any> = {}
): Promise<ActionResult> {
  try {
    const templatedText = templateString(details.text, data);
    await navigator.clipboard.writeText(templatedText);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error during clipboard execution',
    };
  }
}

export async function executeShare(
  details: { title?: string; text?: string; url?: string },
  data: Record<string, any> = {}
): Promise<ActionResult> {
  try {
    if (!navigator.share) {
      return { success: false, message: 'Web Share API not supported in this environment' };
    }

    const templatedTitle = templateString(details.title, data);
    const templatedText = templateString(details.text, data);
    const templatedUrl = templateString(details.url, data);

    const shareData: { title?: string; text?: string; url?: string } = {};
    if (templatedTitle) shareData.title = templatedTitle;
    if (templatedText) shareData.text = templatedText;
    if (templatedUrl) shareData.url = templatedUrl;

    await navigator.share(shareData);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error during share execution',
    };
  }
}

export async function executeWakeLock(
  details: { duration?: number },
  data: Record<string, any> = {}
): Promise<ActionResult> {
  try {
    if (!('wakeLock' in navigator)) {
      return { success: false, message: 'Wake Lock API not supported in this environment' };
    }

    const sentinel = await (navigator as any).wakeLock.request('screen');

    if (details.duration) {
      setTimeout(() => sentinel.release(), details.duration);
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error during wake lock execution',
    };
  }
}

export async function executeSpeech(
  details: { text: string; rate?: number; pitch?: number; volume?: number },
  data: Record<string, any> = {}
): Promise<ActionResult> {
  try {
    if (typeof speechSynthesis === 'undefined') {
      return { success: false, message: 'Speech Synthesis API not supported in this environment' };
    }

    const templatedText = templateString(details.text, data);
    const utterance = new SpeechSynthesisUtterance(templatedText);

    if (details.rate !== undefined) utterance.rate = details.rate;
    if (details.pitch !== undefined) utterance.pitch = details.pitch;
    if (details.volume !== undefined) utterance.volume = details.volume;

    speechSynthesis.speak(utterance);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error during speech execution',
    };
  }
}
