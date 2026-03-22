import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AppLayout } from '@/components/AppLayout';
import { StatusPage } from '@/routes/StatusPage';
import { FlowsPage } from '@/routes/FlowsPage';
import { LibraryPage } from '@/routes/LibraryPage';
import { Toaster } from '@/components/ui/toaster';

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/flows" replace />} />
            <Route path="status" element={<StatusPage />} />
            <Route path="flows" element={<FlowsPage />} />
            <Route path="library" element={<LibraryPage />} />
            <Route path="*" element={<Navigate to="/flows" replace />} />
          </Route>
        </Routes>
        <Toaster />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
