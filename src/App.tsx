import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AppLayout } from '@/components/AppLayout';
import { FlowsPage } from '@/routes/FlowsPage';
import { FlowDetailPage } from '@/routes/FlowDetailPage';
import { ActivityPage } from '@/routes/ActivityPage';
import { DiscoverPage } from '@/routes/DiscoverPage';
import { SettingsPage } from '@/routes/SettingsPage';
import { HowFlowsWorkPage } from '@/routes/HowFlowsWorkPage';
import { WelcomePage } from '@/routes/WelcomePage';
import { TimelinePage } from '@/routes/TimelinePage';
import { TriagePage } from '@/routes/TriagePage';
import { Toaster } from '@/components/ui/toaster';
import { useAuthStore } from '@/store/useAuthStore';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

function IndexRedirect() {
  const { did, loading, onboardingSkipped } = useAuthStore();
  if (loading) return null;
  if (!did && !onboardingSkipped) return <Navigate to="/welcome" replace />;
  return <Navigate to="/timeline" replace />;
}

function SettingsDrawer() {
  const location = useLocation();
  const navigate = useNavigate();
  const isOpen = location.pathname === '/settings';

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) navigate(-1); }}>
      <SheetContent side="top" className="h-[85vh] flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>Settings</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <SettingsPage />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="welcome" element={<WelcomePage />} />
          <Route element={<AppLayout />}>
            <Route index element={<IndexRedirect />} />
            <Route path="timeline" element={<TimelinePage />} />
            <Route path="triage" element={<TriagePage />} />
            <Route path="flows" element={<FlowsPage />} />
            <Route path="flows/:flowId" element={<FlowDetailPage />} />
            <Route path="activity" element={<ActivityPage />} />
            <Route path="discover" element={<DiscoverPage />} />
            <Route path="docs/flows" element={<HowFlowsWorkPage />} />
            <Route path="settings" element={null} />
            <Route path="oauth/callback" element={<Navigate to="/timeline" replace />} />
            <Route path="*" element={<Navigate to="/timeline" replace />} />
          </Route>
        </Routes>
        <SettingsDrawer />
        <Toaster />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
