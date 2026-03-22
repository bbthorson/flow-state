import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AppLayout } from '@/components/AppLayout';
import { FlowsPage } from '@/routes/FlowsPage';
import { ActivityPage } from '@/routes/ActivityPage';
import { DiscoverPage } from '@/routes/DiscoverPage';
import { Toaster } from '@/components/ui/toaster';

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/flows" replace />} />
            <Route path="flows" element={<FlowsPage />} />
            <Route path="activity" element={<ActivityPage />} />
            <Route path="discover" element={<DiscoverPage />} />
            <Route path="*" element={<Navigate to="/flows" replace />} />
          </Route>
        </Routes>
        <Toaster />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
