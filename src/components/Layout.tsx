import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useEffectEvent, useRef } from 'react';
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
  Upload,
  Menu,
  X,
  ChevronDown,
  CalendarDays,
  Pin,
  PinOff,
} from 'lucide-react';
import { listNotifications } from '@/lib/fleet-data';
import { syncAutomaticNotifications } from '@/lib/notification-rules';

const navigationSections = [
  {
    label: 'Workspace',
    items: [{ name: 'Overview', href: '/', icon: LayoutDashboard }],
  },
  {
    label: 'Fleet Operations',
    items: [
      { name: 'Vehicles', href: '/vehicles', icon: Car },
      { name: 'Drivers', href: '/drivers', icon: Users },
      { name: 'Trips', href: '/trips', icon: Route },
      { name: 'Fuel', href: '/fuel', icon: Fuel },
      { name: 'Maintenance', href: '/maintenance', icon: Wrench },
      { name: 'Incidents', href: '/incidents', icon: AlertTriangle },
    ],
  },
  {
    label: 'Records & Control',
    items: [
      { name: 'Reports', href: '/reports', icon: FileText },
      { name: 'Documents', href: '/documents', icon: FolderOpen },
      { name: 'Data Import', href: '/import', icon: Upload, manageRecordsOnly: true },
      { name: 'User Access', href: '/users', icon: Shield, adminOnly: true },
    ],
  },
];

const NOTIFICATION_REFRESH_INTERVAL_MS = 60_000;
const AUTOMATIC_NOTIFICATION_SYNC_INTERVAL_MS = 15 * 60_000;
const AUTOMATIC_NOTIFICATION_SYNC_KEY = 'lfz-last-automatic-notification-sync';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarPinned, setSidebarPinned] = useState(
    () => window.localStorage.getItem('lfz-sidebar-pinned') === 'true'
  );
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [sidebarFocused, setSidebarFocused] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const notificationSoundRef = useRef<HTMLAudioElement | null>(null);
  const knownNotificationIdsRef = useRef<Set<string>>(new Set());
  const hasInitializedNotificationsRef = useRef(false);
  const notificationLoadInFlightRef = useRef(false);
  const { user, logout, canManageUsers, canManageRecords } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const sidebarExpanded = sidebarPinned || sidebarHovered || sidebarFocused;

  useEffect(() => {
    if (!sidebarOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [sidebarOpen]);

  useEffect(() => {
    window.localStorage.setItem('lfz-sidebar-pinned', String(sidebarPinned));
  }, [sidebarPinned]);

  const loadNotifications = useEffectEvent(async () => {
    if (notificationLoadInFlightRef.current) {
      return;
    }

    notificationLoadInFlightRef.current = true;
    try {
      const lastRuleSync = Number(window.localStorage.getItem(AUTOMATIC_NOTIFICATION_SYNC_KEY) ?? 0);
      const shouldSyncRules = Date.now() - lastRuleSync >= AUTOMATIC_NOTIFICATION_SYNC_INTERVAL_MS;

      if (canManageRecords && user?.id && shouldSyncRules) {
        const syncStartedAt = Date.now();
        window.localStorage.setItem(AUTOMATIC_NOTIFICATION_SYNC_KEY, String(syncStartedAt));

        try {
          await syncAutomaticNotifications(user.id);
        } catch (error) {
          if (window.localStorage.getItem(AUTOMATIC_NOTIFICATION_SYNC_KEY) === String(syncStartedAt)) {
            window.localStorage.removeItem(AUTOMATIC_NOTIFICATION_SYNC_KEY);
          }
          console.error('Failed to synchronize automatic notifications', error);
        }
      }

      const allNotifications = await listNotifications();
      const sorted = allNotifications.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setNotifications(sorted);
    } catch (error) {
      console.error('Failed to load notifications', error);
    } finally {
      notificationLoadInFlightRef.current = false;
    }
  });

  useEffect(() => {
    void loadNotifications();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadNotifications();
      }
    }, NOTIFICATION_REFRESH_INTERVAL_MS);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadNotifications();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const today = new Intl.DateTimeFormat('en-NG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

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
    <div className="min-h-screen bg-[#f3f4f1]">
      <a href="#main-content" className="sr-only fixed left-4 top-4 z-[60] rounded-lg bg-white p-3 text-primary focus:not-sr-only">
        Skip to content
      </a>
      <audio ref={notificationSoundRef} src="/notification-sound.mp3" preload="auto" />

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#0d1647]/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        id="fleet-navigation"
        aria-label="Main navigation"
        onFocusCapture={() => setSidebarFocused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setSidebarFocused(false);
        }}
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
        className={`fixed left-0 top-0 z-50 flex h-full w-[17rem] flex-col overflow-hidden bg-[#111d62] text-white shadow-[18px_0_60px_rgba(13,22,71,0.08)] transition-[width,transform] duration-300 ease-out lg:visible lg:translate-x-0 ${
          sidebarExpanded ? 'lg:w-[17rem]' : 'lg:w-20'
        } ${
          sidebarOpen ? 'visible translate-x-0' : 'invisible -translate-x-full'
        }`}
      >
        <div className={`flex h-20 shrink-0 items-center justify-between border-b border-white/10 px-5 ${sidebarExpanded ? 'lg:justify-between lg:px-5' : 'lg:justify-center lg:px-4'}`}>
          <Link
            to="/"
            className={`flex min-w-0 items-center gap-3 ${sidebarExpanded ? 'lg:justify-start lg:gap-3' : 'lg:justify-center lg:gap-0'}`}
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
              <img src="/lfzdc-logo.png" alt="LFZDC Logo" className="h-10 w-10 object-contain" />
            </span>
            <span className={`min-w-0 whitespace-nowrap transition-all duration-200 ${sidebarExpanded ? 'lg:opacity-100' : 'lg:w-0 lg:overflow-hidden lg:opacity-0'}`}>
              <span className="block text-base font-semibold tracking-tight text-white">LFZ Fleet</span>
              <span className="mt-0.5 block truncate text-[10px] font-medium uppercase tracking-[0.15em] text-blue-100/60">
                Fleet management
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            {sidebarExpanded ? (
              <button
                onClick={() => setSidebarPinned((pinned) => !pinned)}
                className="hidden rounded-lg p-2 text-blue-100/65 transition-colors hover:bg-white/10 hover:text-white lg:flex"
                aria-label={sidebarPinned ? 'Use compact sidebar' : 'Keep sidebar expanded'}
                title={sidebarPinned ? 'Use compact sidebar' : 'Keep sidebar expanded'}
              >
                {sidebarPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              </button>
            ) : null}
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-2 text-blue-100 transition-colors hover:bg-white/10 lg:hidden"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <ScrollArea className="min-h-0 w-full flex-1">
          <nav aria-label="Fleet pages" className={`w-full space-y-6 px-4 py-6 ${sidebarExpanded ? 'lg:w-full lg:px-4' : 'lg:w-20 lg:px-3'}`}>
            {navigationSections.map((section) => {
              const visibleItems = section.items.filter(
                (item) => (!item.adminOnly || canManageUsers) && (!item.manageRecordsOnly || canManageRecords)
              );

              if (visibleItems.length === 0) {
                return null;
              }

              return (
                <div key={section.label}>
                  <p className={`mb-2 h-4 overflow-hidden whitespace-nowrap px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-100/65 transition-opacity duration-200 ${sidebarExpanded ? 'lg:opacity-100' : 'lg:opacity-0'}`}>
                    {section.label}
                  </p>
                  <div className="space-y-1">
                    {visibleItems.map((item) => {
                      const isActive =
                        item.href === '/'
                          ? location.pathname === '/'
                          : location.pathname.startsWith(item.href);

                      return (
                        <Link
                          key={item.name}
                          to={item.href}
                          aria-current={isActive ? 'page' : undefined}
                          aria-label={item.name}
                          onClick={() => setSidebarOpen(false)}
                          title={sidebarExpanded ? undefined : item.name}
                          className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                            sidebarExpanded
                              ? 'lg:h-12 lg:w-full lg:justify-start lg:gap-3 lg:px-3'
                              : 'lg:mx-auto lg:h-12 lg:w-12 lg:justify-center lg:gap-0 lg:p-0'
                          } ${
                            isActive
                              ? 'bg-white text-[#111d62] shadow-[0_8px_24px_rgba(5,12,50,0.18)]'
                              : 'text-blue-50/70 hover:bg-white/[0.07] hover:text-white'
                          }`}
                        >
                          {isActive ? (
                            <span className={`absolute -left-4 h-6 w-1 rounded-r-full bg-[#ed1c24] ${sidebarExpanded ? '' : 'lg:hidden'}`} />
                          ) : null}
                          <item.icon className={`h-[18px] w-[18px] ${isActive ? 'text-[#ed1c24]' : 'text-blue-100/60 group-hover:text-white'}`} />
                          <span className={`whitespace-nowrap transition-all duration-200 ${sidebarExpanded ? 'lg:opacity-100' : 'lg:w-0 lg:overflow-hidden lg:opacity-0'}`}>
                            {item.name}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        </ScrollArea>

        <div className={`border-t border-white/10 p-4 ${sidebarExpanded ? 'lg:px-4' : 'lg:px-3'}`}>
          <Link to="/settings" aria-label="Settings" onClick={() => setSidebarOpen(false)}
            className={`flex h-12 items-center gap-3 rounded-lg text-sm text-blue-50/80 hover:bg-white/10 hover:text-white ${sidebarExpanded ? 'px-3' : 'lg:justify-center'}`}>
            <Settings className="h-[18px] w-[18px] shrink-0" />
            <span className={sidebarExpanded ? '' : 'lg:hidden'}>Settings</span>
          </Link>
        </div>
      </aside>

      <div className={`transition-[margin] duration-300 ease-out ${sidebarPinned ? 'lg:ml-[17rem]' : 'lg:ml-20'}`}>
        <header className="sticky top-0 z-30 h-20 border-b border-black/[0.06] bg-white/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="mx-auto flex h-full max-w-[1600px] items-center justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-lg border border-gray-200 bg-white p-2 text-gray-700 shadow-sm transition-colors hover:bg-gray-50 lg:hidden"
                aria-label="Open navigation"
                aria-expanded={sidebarOpen}
                aria-controls="fleet-navigation"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex min-w-0 items-center gap-2 text-sm text-gray-600">
                <CalendarDays className="h-[18px] w-[18px] shrink-0 text-[#15247f]" />
                <span className="hidden whitespace-nowrap font-medium text-gray-700 sm:inline">{today}</span>
                <span className="whitespace-nowrap font-medium text-gray-700 sm:hidden">{new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short' }).format(new Date())}</span>
                <span className="hidden text-gray-300 sm:inline">·</span>
                <span className="hidden whitespace-nowrap text-gray-500 sm:inline">Lekki Free Zone</span>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => navigate('/notifications')}
                className="relative flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white transition-colors hover:bg-gray-50"
                aria-label="Open notifications"
              >
                <Bell className="h-[18px] w-[18px] text-gray-600" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-[#ed1c24] px-1 text-[10px] font-semibold text-white ring-2 ring-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button aria-label="Account menu" className="flex items-center gap-2.5 rounded-full border border-gray-200 bg-white py-1.5 pl-1.5 pr-2.5 transition-colors hover:bg-gray-50">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#111d62] text-white">
                      <span className="text-xs font-semibold">{user?.name?.charAt(0).toUpperCase() || 'A'}</span>
                    </div>
                    <span className="hidden text-left sm:block">
                      <span className="block max-w-36 truncate text-xs font-semibold text-gray-900">{user?.name || 'My account'}</span>
                      <span className="block text-xs capitalize text-gray-500">{user?.role?.replace(/_/g, ' ') || 'Staff'}</span>
                    </span>
                    <ChevronDown className="h-4 w-4 text-gray-400" />
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

        <main id="main-content" tabIndex={-1} className="min-w-0 px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
