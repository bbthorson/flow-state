import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AppLayout } from '@/components/AppLayout';
import { FlowsPage } from '@/routes/FlowsPage';
import { ActivityPage } from '@/routes/ActivityPage';
import { DiscoverPage } from '@/routes/DiscoverPage';
import { SettingsPage } from '@/routes/SettingsPage';
import { HowFlowsWorkPage } from '@/routes/HowFlowsWorkPage';
import { WelcomePage } from '@/routes/WelcomePage';
import { TimelinePage } from '@/routes/TimelinePage';
import { Toaster } from '@/components/ui/toaster';
import { useAuthStore } from '@/store/useAuthStore';

function IndexRedirect() {
  const { did, loading, onboardingSkipped } = useAuthStore();
  if (loading) return null;
  if (!did && !onboardingSkipped) return <Navigate to="/welcome" replace />;
  return <Navigate to="/flows" replace />;
}

function SettingsOverlay() {
  const location = useLocation();
  if (location.pathname !== '/settings') return null;
  return <SettingsPage />;
}

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="welcome" element={<WelcomePage />} />
          <Route element={<AppLayout />}>
            <Route index element={<IndexRedirect />} />
            <Route path="flows" element={<FlowsPage />} />
            <Route path="timeline" element={<TimelinePage />} />
            <Route path="activity" element={<ActivityPage />} />
            <Route path="discover" element={<DiscoverPage />} />
            <Route path="docs/flows" element={<HowFlowsWorkPage />} />
            <Route path="settings" element={null} />
            <Route path="oauth/callback" element={<Navigate to="/flows" replace />} />
            <Route path="*" element={<Navigate to="/flows" replace />} />
          </Route>
        </Routes>
        <SettingsOverlay />
        <Toaster />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
