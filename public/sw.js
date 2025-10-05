
// public/sw.js

self.addEventListener('install', (event) => {
  console.log('Service Worker installing.');
  // Add any assets to cache here.
});

let charging = false;
let faceDown = false;
let webhooks = [];

function canSendWebhook(webhookConfig, charging, faceDown) {
  if (!webhookConfig.enabled) {
    return false;
  }
  return (
    (webhookConfig.charging && charging === true) ||
    (webhookConfig.orientation && faceDown === true)
  );
}

async function sendWebhookNotification(webhookUrl, payload) {
  const maxRetries = 3;
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        console.log('Webhook notification sent successfully.');
        return true;
      }

      console.error(`Webhook notification failed with status: ${response.status}`);
    } catch (error) {
      console.error('Error sending webhook notification:', error);
    }

    attempt++;
    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt - 1) * 1000;
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return false;
}

async function sendWebhook(webhookConfig, charging, faceDown) {
  if (canSendWebhook(webhookConfig, charging, faceDown)) {
    try {
      await sendWebhookNotification(webhookConfig.url, {
        message: 'Device status changed',
        timestamp: new Date().toISOString(),
        trigger: { charging, orientation: faceDown },
      });
      return true;
    } catch (error) {
      console.error('Error sending webhook:', error);
      return false;
    }
  }
  return false;
}

function triggerWebhookCheck() {
  webhooks.forEach(webhook => {
    sendWebhook(webhook, charging, faceDown);
  });
}

function sendMessageToClient(client, message) {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => {
      if (event.data.error) {
        reject(event.data.error);
      } else {
        resolve(event.data);
      }
    };
    client.postMessage(message, [channel.port2]);
  });
}

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating.');
  // Start monitoring battery status
  if ('getBattery' in navigator) {
    navigator.getBattery().then(battery => {
      charging = battery.charging;
      console.log('Initial battery status:', charging);
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          sendMessageToClient(client, { type: 'charging', charging: charging });
        });
      });
      battery.addEventListener('chargingchange', () => {
        charging = battery.charging;
        console.log('Battery status changed:', charging);
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            sendMessageToClient(client, { type: 'charging', charging: charging });
          });
        });
        triggerWebhookCheck();
      });
    });
  } else {
    console.log('Battery Status API not supported in service worker.');
  }
});

self.addEventListener('message', (event) => {
  if (event.data.type === 'orientation') {
    faceDown = event.data.faceDown;
    console.log('Orientation status updated:', faceDown);
    triggerWebhookCheck();
  } else if (event.data.type === 'webhooks') {
    webhooks = event.data.webhooks;
    console.log('Webhooks updated:', webhooks);
  }
});

self.addEventListener('fetch', (event) => {
  // This is a placeholder for handling fetch events.
  // We will add more logic here later.
});

