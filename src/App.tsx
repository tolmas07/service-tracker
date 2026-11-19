import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/authStore';
import { useVersionCheck } from './hooks/useVersionCheck';
import { UpdateDialog } from './components/Layout/UpdateDialog';
import { LoginPage } from './components/Auth/LoginPage';
import { Header, BottomNav } from './components/Layout/Layout';

// Route-level code splitting for faster mobile initial load
const MapView = lazy(() => import('./components/Map/MapView').then((m) => ({ default: m.MapView })));
const HistoryPage = lazy(() => import('./components/Visits/HistoryPage').then((m) => ({ default: m.HistoryPage })));
const VisitForm = lazy(() => import('./components/Visits/VisitForm').then((m) => ({ default: m.VisitForm })));
const EditVisitPage = lazy(() => import('./components/Visits/EditVisitPage').then((m) => ({ default: m.EditVisitPage })));
const PointDetailPage = lazy(() => import('./components/Points/PointDetailPage').then((m) => ({ default: m.PointDetailPage })));
const ManagerDashboard = lazy(() => import('./components/Layout/ManagerDashboard').then((m) => ({ default: m.ManagerDashboard })));
const ManagerVisitsPage = lazy(() => import('./components/Layout/ManagerVisitsPage').then((m) => ({ default: m.ManagerVisitsPage })));
const ManualTripForm = lazy(() => import('./components/Tracker/ManualTripForm').then((m) => ({ default: m.ManualTripForm })));
const PrintReportPage = lazy(() => import('./components/Reports/PrintReportPage').then((m) => ({ default: m.PrintReportPage })));
const ResetOrderPage = lazy(() => import('./components/Reset/ResetOrderPage').then((m) => ({ default: m.ResetOrderPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function PageLoader() {
  return <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Загрузка...</div>;
}

function VisitFormPage() {
  const [searchParams] = useSearchParams();
  const pointId = searchParams.get('point') || undefined;
  return <VisitForm pointId={pointId} />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
}

function WorkerOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" />;
  if (user.role === 'manager') return <Navigate to="/manager" />;
  return <>{children}</>;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <Header />
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
        <Suspense fallback={<PageLoader />}>{children}</Suspense>
      </main>
      <BottomNav />
    </div>
  );
}

function App() {
  const { loadUser } = useAuthStore();
  const versionCheck = useVersionCheck();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {versionCheck.needsUpdate && !versionCheck.dismissed && (
          <UpdateDialog
            forceUpdate={versionCheck.forceUpdate}
            latestVersion={versionCheck.latestVersion}
            apkUrl={versionCheck.apkUrl}
            changelog={versionCheck.changelog}
            onDismiss={versionCheck.dismiss}
          />
        )}

        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <MapView />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/prints"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <PrintReportPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reset"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ResetOrderPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/trip"
            element={
              <WorkerOnlyRoute>
                <AppLayout>
                  <ManualTripForm />
                </AppLayout>
              </WorkerOnlyRoute>
            }
          />
          <Route
            path="/history"
            element={
              <WorkerOnlyRoute>
                <AppLayout>
                  <HistoryPage />
                </AppLayout>
              </WorkerOnlyRoute>
            }
          />
          <Route
            path="/visits/new"
            element={
              <WorkerOnlyRoute>
                <AppLayout>
                  <VisitFormPage />
                </AppLayout>
              </WorkerOnlyRoute>
            }
          />
          <Route
            path="/visits/:id/edit"
            element={
              <WorkerOnlyRoute>
                <AppLayout>
                  <EditVisitPage />
                </AppLayout>
              </WorkerOnlyRoute>
            }
          />
          <Route
            path="/points/:id"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <PointDetailPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ManagerDashboard />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager/visits"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ManagerVisitsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
