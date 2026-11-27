import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ContextHome } from '@/vnext/ContextHome';
import { Toaster } from '@/components/ui/toaster';

export function App() {
  return (
    <ErrorBoundary>
      <ContextHome />
      <Toaster />
    </ErrorBoundary>
  );
}
