import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AppLayout } from '@/components/AppLayout';
import { CompassShell } from '@/components/compass-shell';
import { FlowDetailPage } from '@/routes/FlowDetailPage';
import { DiscoverPage } from '@/routes/DiscoverPage';
import { HowFlowsWorkPage } from '@/routes/HowFlowsWorkPage';
import { WelcomePage } from '@/routes/WelcomePage';
import { Toaster } from '@/components/ui/toaster';
import { useAuthStore } from '@/store/useAuthStore';

function IndexGate() {
  const { did, loading, onboardingSkipped } = useAuthStore();
  if (loading) return null;
  if (!did && !onboardingSkipped) return <Navigate to="/welcome" replace />;
  return <CompassShell />;
}

/** Standard scroll container for secondary (drill-in) routes. */
function ScrollFrame({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 min-h-0 overflow-y-auto p-4">{children}</div>;
}

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="welcome" element={<WelcomePage />} />
          <Route element={<AppLayout />}>
            <Route index element={<IndexGate />} />
            <Route path="flows/:flowId" element={<ScrollFrame><FlowDetailPage /></ScrollFrame>} />
            <Route path="discover" element={<ScrollFrame><DiscoverPage /></ScrollFrame>} />
            <Route path="docs/flows" element={<ScrollFrame><HowFlowsWorkPage /></ScrollFrame>} />
            <Route path="oauth/callback" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        <Toaster />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
