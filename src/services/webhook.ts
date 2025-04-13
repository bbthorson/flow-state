/**
 * Sends a POST request to the specified webhook URL with the provided data.
 *
 * @param webhookUrl The URL to send the POST request to.
 * @param data The data to include in the request body.
 * @returns A promise that resolves when the request is complete.
 */
export async function sendWebhookNotification(
  webhookUrl: string,
  data: any
): Promise<void> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      console.error(
        `Webhook notification failed with status: ${response.status}`
      );
    } else {
      console.log('Webhook notification sent successfully.');
    }
  } catch (error) {
    console.error('Error sending webhook notification:', error);
  }
}
