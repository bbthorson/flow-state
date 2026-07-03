import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AppLayout } from '@/components/AppLayout';
import { CompassShell } from '@/components/compass-shell';
import { Toaster } from '@/components/ui/toaster';
import { useAuthStore } from '@/store/useAuthStore';

// Secondary surfaces are code-split so they don't weigh down the initial (home) load.
const WelcomePage = lazy(() => import('@/routes/WelcomePage').then((m) => ({ default: m.WelcomePage })));
const FlowDetailPage = lazy(() => import('@/routes/FlowDetailPage').then((m) => ({ default: m.FlowDetailPage })));
const DiscoverPage = lazy(() => import('@/routes/DiscoverPage').then((m) => ({ default: m.DiscoverPage })));
const HowFlowsWorkPage = lazy(() => import('@/routes/HowFlowsWorkPage').then((m) => ({ default: m.HowFlowsWorkPage })));

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
        <Suspense fallback={<div className="flex h-dvh items-center justify-center text-sm text-muted-foreground">Loading…</div>}>
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
        </Suspense>
        <Toaster />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
