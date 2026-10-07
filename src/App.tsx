// Cambio menor para forzar redeploy y verificar fallback SPA en Vercel
//
//
//
//
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ReportProvider } from './context/ReportContext';
import { TypesProvider } from './context/TypesContext';

// Pages
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ReportsPage } from './pages/ReportsPage';
import { NewReportPage } from './pages/NewReportPage';
import { ReportViewPage } from './pages/ReportViewPage';
import { MediaReportPage } from './pages/MediaReportPage';
import ProfilePage from './pages/ProfilePage';
import RegisterPage from './pages/RegisterPage';
import AdminPage from './pages/AdminPage';
import { UsersAdminPage } from './pages/UsersAdminPage';
import { ResourcesPage } from './pages/ResourcesPage';
import { ParametersPage } from './pages/ParametersPage';
import { ActsPage } from './pages/ActsPage';
import { ActFormPage } from './pages/ActFormPage';
import { ActHtmlPage } from './pages/ActHtmlPage';
import { LoadingSpinner } from './components/molecules/LoadingSpinner';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state } = useAuth();
  const location = useLocation();

  if (state.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!state.isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const { state } = useAuth();
  const location = useLocation();
  const returnTo = (location.state as { from?: string } | null)?.from;

  if (state.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          state.isAuthenticated
            ? <Navigate to={returnTo && returnTo !== '/login' ? returnTo : '/dashboard'} replace />
            : <LoginPage />
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <ReportsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/new"
        element={
          <ProtectedRoute>
            <NewReportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/:id/media"
        element={
          <ProtectedRoute>
            <MediaReportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/:id"
        element={
          <ProtectedRoute>
            <ReportViewPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/:id/edit"
        element={
          <ProtectedRoute>
            <NewReportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/register"
        element={<RegisterPage />}
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute>
            <UsersAdminPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/resources"
        element={
          <ProtectedRoute>
            <ResourcesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/parameters"
        element={
          <ProtectedRoute>
            <ParametersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/acts"
        element={
          <ProtectedRoute>
            <ActsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/acts/new"
        element={
          <ProtectedRoute>
            <ActFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/acts/:id/edit"
        element={
          <ProtectedRoute>
            <ActFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/acts/:id/html"
        element={
          <ProtectedRoute>
            <ActHtmlPage />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TypesProvider>
          <ReportProvider>
            <Router>
              <div className="min-h-screen bg-slate-50">
                <AppRoutes />
              </div>
            </Router>
          </ReportProvider>
        </TypesProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;