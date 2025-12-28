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

export async function executeWebhook(details: WebhookDetails): Promise<ActionResult> {
  try {
    const response = await fetch(details.url, {
      method: details.method || 'POST',
      headers: details.headers,
      body: details.body,
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

export async function executeNotification(details: NotificationDetails): Promise<ActionResult> {
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

    new Notification(details.title, {
      body: details.body,
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
