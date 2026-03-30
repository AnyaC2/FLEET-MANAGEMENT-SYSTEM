import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from '@/context/AuthContext';

// Pages
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Vehicles from '@/pages/Vehicles';
import VehicleDetail from '@/pages/VehicleDetail';
import Drivers from '@/pages/Drivers';
import DriverDetail from '@/pages/DriverDetail';
import Fuel from '@/pages/Fuel';
import Maintenance from '@/pages/Maintenance';
import Incidents from '@/pages/Incidents';
import Trips from '@/pages/Trips';
import Reports from '@/pages/Reports';
import Documents from '@/pages/Documents';
import Notifications from '@/pages/Notifications';
import Profile from '@/pages/Profile';
import Settings from '@/pages/Settings';
import UserManagement from '@/pages/UserManagement';
import Layout from '@/components/Layout';
import { useEffect, useRef } from 'react';
import { clearAllData } from '@/lib/db';
import { isSupabaseConfigured } from '@/lib/supabase';

// Protected Route component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading, needsMfaVerification } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
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

function PermissionRoute({ children, requireManageUsers = false }: { children: React.ReactNode; requireManageUsers?: boolean }) {
  const { canManageUsers } = useAuth();

  if (requireManageUsers && !canManageUsers) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
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
  );
}

function ToastSoundPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      let shouldPlaySound = false;

      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (!(node instanceof HTMLElement)) {
            continue;
          }

          if (node.matches('[data-sonner-toast]') || node.querySelector('[data-sonner-toast]')) {
            shouldPlaySound = true;
            break;
          }
        }

        if (shouldPlaySound) {
          break;
        }
      }

      if (!shouldPlaySound || !audioRef.current) {
        return;
      }

      audioRef.current.currentTime = 0;
      void audioRef.current.play().catch((error) => {
        console.debug('Toast sound playback was blocked or failed.', error);
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return <audio ref={audioRef} src="/notification-sound.mp3" preload="auto" />;
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
      <ToastSoundPlayer />
      <Toaster position="top-right" />
    </AuthProvider>
  );
}

export default App;
