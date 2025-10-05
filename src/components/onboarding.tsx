
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface OnboardingProps {
  deferredPrompt: any;
  onComplete: () => void;
}

export function Onboarding({
  deferredPrompt,
  onComplete,
}: OnboardingProps) {
  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      }
      onComplete();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to Flow State!</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p>This app helps you automate tasks based on your phone&apos;s status.</p>
          <p>For the best experience, please install this app to your home screen. This will allow it to run in the background and send webhooks reliably.</p>
          {deferredPrompt && (
            <Button onClick={handleInstallClick}>Install App</Button>
          )}
          <Button variant="outline" onClick={onComplete}>Maybe Later</Button>
        </CardContent>
      </Card>
    </div>
  );
}
