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

/**
 * Landing spot for the OAuth redirect back from the PDS.
 *
 * Do NOT navigate away while auth is still initializing. The client matches
 * `location.pathname` against its registered `redirect_uris` and reads the
 * response out of the URL fragment; leaving `/oauth/callback` early makes that
 * lookup miss and the sign-in silently degrades into a plain session restore.
 * `useAuthStore` starts in the loading state on a callback boot, so this holds
 * from the very first render rather than relying on effect ordering. The client
 * clears the params itself once it has consumed them.
 */
function OAuthCallback() {
  const loading = useAuthStore((s) => s.loading);
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Signing in…
      </div>
    );
  }
  return <Navigate to="/" replace />;
}

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
          {/* Welcome renders outside AppLayout, so it needs its own boundary. */}
          <Route
            path="welcome"
            element={
              <Suspense fallback={<div className="flex h-dvh items-center justify-center text-sm text-muted-foreground">Loading…</div>}>
                <WelcomePage />
              </Suspense>
            }
          />
          {/* Routes below suspend inside AppLayout's own boundary (see AppLayout),
              so the persistent shell + device hooks stay mounted across navigation. */}
          <Route element={<AppLayout />}>
            <Route index element={<IndexGate />} />
            <Route path="flows/:flowId" element={<ScrollFrame><FlowDetailPage /></ScrollFrame>} />
            <Route path="discover" element={<ScrollFrame><DiscoverPage /></ScrollFrame>} />
            <Route path="docs/flows" element={<ScrollFrame><HowFlowsWorkPage /></ScrollFrame>} />
            <Route path="oauth/callback" element={<OAuthCallback />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        <Toaster />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
