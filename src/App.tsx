import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './stores/authStore';
import { LoginPage } from './components/Auth/LoginPage';
import { Header, BottomNav } from './components/Layout/Layout';
import { MapView } from './components/Map/MapView';
import { TripPage } from './components/Tracker/TripPage';
import { HistoryPage } from './components/Visits/HistoryPage';
import { VisitForm } from './components/Visits/VisitForm';
import { EditVisitPage } from './components/Visits/EditVisitPage';
import { PointDetailPage } from './components/Points/PointDetailPage';
import { ManagerDashboard } from './components/Layout/ManagerDashboard';
import { ManualTripForm } from './components/Tracker/ManualTripForm';
import { useSearchParams } from 'react-router-dom';

const queryClient = new QueryClient();

function VisitFormPage() {
  const [searchParams] = useSearchParams();
  const pointId = searchParams.get('point') || undefined;
  return <VisitForm pointId={pointId} />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  if (loading) return <div className="flex-1 flex items-center justify-center text-gray-400">Загрузка...</div>;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
}

function WorkerOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  if (loading) return <div className="flex-1 flex items-center justify-center text-gray-400">Загрузка...</div>;
  if (!user) return <Navigate to="/login" />;
  if (user.role === 'manager') return <Navigate to="/manager" />;
  return <>{children}</>;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <Header />
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden relative">{children}</main>
      <BottomNav />
    </div>
  );
}

function App() {
  const { loadUser } = useAuthStore();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
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
            path="/trip"
            element={
              <WorkerOnlyRoute>
                <AppLayout>
                  <TripPage />
                </AppLayout>
              </WorkerOnlyRoute>
            }
          />
          <Route
            path="/trips/new"
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
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
