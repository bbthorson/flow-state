'use client';

import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="flex h-screen w-full flex-col items-center justify-center gap-4 p-4 text-center">
          <h2 className="text-2xl font-bold">Something went wrong!</h2>
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </div>
      </body>
    </html>
  );
}
