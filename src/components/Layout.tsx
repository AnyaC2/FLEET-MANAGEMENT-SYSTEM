import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { Notification } from '@/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LayoutDashboard,
  Car,
  Users,
  Fuel,
  Wrench,
  AlertTriangle,
  Route,
  FileText,
  FolderOpen,
  Bell,
  User,
  Settings,
  LogOut,
  Shield,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react';
import { listNotifications } from '@/lib/fleet-data';
import { syncAutomaticNotifications } from '@/lib/notification-rules';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Vehicles', href: '/vehicles', icon: Car },
  { name: 'Drivers', href: '/drivers', icon: Users },
  { name: 'Fuel', href: '/fuel', icon: Fuel },
  { name: 'Maintenance', href: '/maintenance', icon: Wrench },
  { name: 'Incidents', href: '/incidents', icon: AlertTriangle },
  { name: 'Trips', href: '/trips', icon: Route },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Documents', href: '/documents', icon: FolderOpen },
  { name: 'Users', href: '/users', icon: Shield, adminOnly: true },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notificationSoundRef = useRef<HTMLAudioElement | null>(null);
  const knownNotificationIdsRef = useRef<Set<string>>(new Set());
  const hasInitializedNotificationsRef = useRef(false);
  const { user, logout, canManageUsers, canManageRecords } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    void loadNotifications();
    const interval = setInterval(() => {
      void loadNotifications();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    try {
      if (canManageRecords) {
        await syncAutomaticNotifications();
      }
      const allNotifications = await listNotifications();
      const sorted = allNotifications.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setNotifications(sorted);
    } catch (error) {
      console.error('Failed to load notifications', error);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    const latestNotificationIds = new Set(notifications.map((notification) => notification.id));

    if (!hasInitializedNotificationsRef.current) {
      knownNotificationIdsRef.current = latestNotificationIds;
      hasInitializedNotificationsRef.current = true;
      return;
    }

    const hasNewUnreadNotification = notifications.some(
      (notification) =>
        !notification.isRead && !knownNotificationIdsRef.current.has(notification.id)
    );

    knownNotificationIdsRef.current = latestNotificationIds;

    if (!hasNewUnreadNotification) {
      return;
    }

    const audio = notificationSoundRef.current;
    if (!audio) {
      return;
    }

    audio.currentTime = 0;
    void audio.play().catch((error) => {
      console.debug('Notification sound playback was blocked or failed.', error);
    });
  }, [notifications]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <audio ref={notificationSoundRef} src="/notification-sound.mp3" preload="auto" />

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-900/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <Link to="/" className="flex items-center gap-2">
             <img 
               src="/lfzdc-logo.png" 
               alt="LFZDC Logo" 
               className="h-8 w-auto" 
             />
             <span className="font-bold text-lg text-gray-900">LFZ Fleet</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <ScrollArea className="h-[calc(100vh-64px)]">
          <nav className="p-4 space-y-1">
            {navigation
              .filter((item) => !item.adminOnly || canManageUsers)
              .map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </ScrollArea>
      </aside>

      {/* Main content */}
      <div className="lg:ml-64">
        {/* Header */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-full">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              {/* Notifications */}
              <button
                onClick={() => navigate('/notifications')}
                className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Bell className="w-5 h-5 text-gray-600" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-medium rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* User dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <span className="hidden sm:block text-sm font-medium text-gray-700">
                      {user?.name || 'Admin User'}
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>My Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/profile')}>
                    <User className="w-4 h-4 mr-2" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/settings')}>
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
