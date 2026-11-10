import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { clearAllData } from '@/lib/db';
import { isSupabaseConfigured } from '@/lib/supabase';

const Layout = lazy(() => import('@/components/Layout'));
const Login = lazy(() => import('@/pages/Login'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Vehicles = lazy(() => import('@/pages/Vehicles'));
const VehicleDetail = lazy(() => import('@/pages/VehicleDetail'));
const Drivers = lazy(() => import('@/pages/Drivers'));
const DriverDetail = lazy(() => import('@/pages/DriverDetail'));
const Fuel = lazy(() => import('@/pages/Fuel'));
const Maintenance = lazy(() => import('@/pages/Maintenance'));
const Incidents = lazy(() => import('@/pages/Incidents'));
const Trips = lazy(() => import('@/pages/Trips'));
const Reports = lazy(() => import('@/pages/Reports'));
const Documents = lazy(() => import('@/pages/Documents'));
const Notifications = lazy(() => import('@/pages/Notifications'));
const Profile = lazy(() => import('@/pages/Profile'));
const Settings = lazy(() => import('@/pages/Settings'));
const UserManagement = lazy(() => import('@/pages/UserManagement'));
const DataImport = lazy(() => import('@/pages/DataImport'));

function AppLoading() {
  return (
    <div className="flex h-screen items-center justify-center" role="status" aria-label="Loading application">
      <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading, needsMfaVerification } = useAuth();

  if (isLoading) {
    return (
      <AppLoading />
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (needsMfaVerification) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PermissionRoute({
  children,
  requireManageUsers = false,
  requireManageRecords = false,
}: {
  children: ReactNode;
  requireManageUsers?: boolean;
  requireManageRecords?: boolean;
}) {
  const { canManageUsers, canManageRecords } = useAuth();

  if (requireManageUsers && !canManageUsers) {
    return <Navigate to="/" replace />;
  }

  if (requireManageRecords && !canManageRecords) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Suspense fallback={<AppLoading />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="vehicles" element={<Vehicles />} />
          <Route path="vehicles/:id" element={<VehicleDetail />} />
          <Route path="drivers" element={<Drivers />} />
          <Route path="drivers/:id" element={<DriverDetail />} />
          <Route path="fuel" element={<Fuel />} />
          <Route path="maintenance" element={<Maintenance />} />
          <Route path="incidents" element={<Incidents />} />
          <Route path="trips" element={<Trips />} />
          <Route path="reports" element={<Reports />} />
          <Route path="documents" element={<Documents />} />
          <Route
            path="import"
            element={
              <PermissionRoute requireManageRecords>
                <DataImport />
              </PermissionRoute>
            }
          />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<Profile />} />
          <Route path="settings" element={<Settings />} />
          <Route
            path="users"
            element={
              <PermissionRoute requireManageUsers>
                <UserManagement />
              </PermissionRoute>
            }
          />
        </Route>
      </Routes>
    </Suspense>
  );
}

function App() {
  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    clearAllData();
  }, []);

  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
      <Toaster position="top-right" />
    </AuthProvider>
  );
}

export default App;
