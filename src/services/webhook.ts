/**
  * Sends a POST request to the specified webhook URL with the formatted data.
  * The data includes the charging status and the phone's position.
  *
  * @param webhookUrl The URL to send the POST request to.
  * @param isCharging The battery charging state (true if charging, false otherwise).
  * @param phonePosition The phone's position (e.g., "upright", "laying").
  * @returns A promise that resolves to a boolean indicating success (true) or failure (false).
  */
export async function sendWebhookNotification(
  webhookUrl: string, 
  isCharging: boolean,
  phonePosition: string
): Promise<boolean> {
  try {
    // Format the payload as a JSON blob with charging and position data
    const payload = {
      charging: isCharging,
      position: phonePosition,
    };

    // Send the POST request with the formatted payload
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    // Handle the response status
    if (!response.ok) {
      console.error(
        `Webhook notification failed with status: ${response.status}`
      );
      return false;
    } else {
      console.log('Webhook notification sent successfully.');
      return true;
    }
  } catch (error) {
    console.error('Error sending webhook notification:', error);
    return false;
  }
}
