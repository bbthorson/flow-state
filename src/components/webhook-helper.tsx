
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function WebhookHelper({ onClose }: { onClose: () => void }) {
  const jsonPayload = JSON.stringify(
    {
      message: 'Device status changed',
      timestamp: new Date().toISOString(),
      trigger: { charging: true, orientation: false },
    },
    null,
    2
  );

  const nodeJsSnippet = `
const express = require('express');
const app = express();
app.use(express.json());

app.post('/webhook', (req, res) => {
  console.log('Received webhook:', req.body);
  res.status(200).send('Webhook received');
});

app.listen(3000, () => console.log('Server listening on port 3000'));
  `;

  const pythonSnippet = `
from flask import Flask, request

app = Flask(__name__)

@app.route('/webhook', methods=['POST'])
def webhook():
    print('Received webhook:', request.json)
    return 'Webhook received', 200

if __name__ == '__main__':
    app.run(port=3000)
  `;

  return (
    <Card className="relative">
      <CardHeader>
        <CardTitle>Webhook Helper</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="zapier">
          <TabsList>
            <TabsTrigger value="zapier">Zapier/IFTTT</TabsTrigger>
            <TabsTrigger value="developers">For Developers</TabsTrigger>
            <TabsTrigger value="testing">Testing</TabsTrigger>
          </TabsList>
          <TabsContent value="zapier">
            <div className="flex flex-col gap-4 pt-4">
              <p>Use these services to connect to thousands of apps without writing any code.</p>
              <Button asChild variant="outline">
                <a href="https://zapier.com/apps/webhook/integrations" target="_blank" rel="noopener noreferrer">
                  Create a Zapier Webhook
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href="https://ifttt.com/create" target="_blank" rel="noopener noreferrer">
                  Create an IFTTT Webhook
                </a>
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="developers">
            <div className="flex flex-col gap-4 pt-4">
              <p>The app will send a POST request with the following JSON payload:</p>
              <pre className="p-2 bg-muted rounded-md text-sm"><code>{jsonPayload}</code></pre>
              <p>Here are some code snippets to get you started:</p>
              <h4 className="font-semibold">Node.js (with Express)</h4>
              <pre className="p-2 bg-muted rounded-md text-sm"><code>{nodeJsSnippet}</code></pre>
              <h4 className="font-semibold">Python (with Flask)</h4>
              <pre className="p-2 bg-muted rounded-md text-sm"><code>{pythonSnippet}</code></pre>
            </div>
          </TabsContent>
          <TabsContent value="testing">
            <div className="flex flex-col gap-4 pt-4">
              <p>Use these services to get a temporary URL to test your webhooks.</p>
              <Button asChild variant="outline">
                <a href="https://webhook.site/" target="_blank" rel="noopener noreferrer">
                  Webhook.site
                </a>
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
