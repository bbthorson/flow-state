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
