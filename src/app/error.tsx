'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  const isChunkError = error.message.includes('Loading chunk') || error.message.includes('Importing a module script failed');

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 p-4 text-center">
      <h2 className="text-2xl font-bold">Something went wrong!</h2>
      <p className="text-muted-foreground">
        {isChunkError
          ? 'A new version of the app is available.'
          : 'An unexpected error occurred.'}
      </p>
      <Button
        onClick={() => {
          if (isChunkError) {
            window.location.reload();
          } else {
            reset();
          }
        }}
      >
        {isChunkError ? 'Reload' : 'Try again'}
      </Button>
    </div>
  );
}
