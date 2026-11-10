import { useState, useEffect, useEffectEvent } from 'react';
import type { Notification, Vehicle, Driver } from '@/types';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Bell, Check, AlertTriangle, Wrench, Fuel, FileText, User } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import {
  listNotifications,
  listVehiclesAndDrivers,
  updateNotification,
} from '@/lib/fleet-data';

export default function Notifications() {
  const { canManageRecords } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);

  async function loadData() {
    const [notifData, related] = await Promise.all([
      listNotifications(),
      listVehiclesAndDrivers(),
    ]);
    const sortedNotifs = notifData.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    setNotifications(sortedNotifs);
    setVehicles(related.vehicles);
    setDrivers(related.drivers);
  }

  const loadInitialData = useEffectEvent(() => loadData());

  useEffect(() => {
    void loadInitialData();
  }, []);

  const markAsRead = async (id: string) => {
    await updateNotification(id, { isRead: true });
    await loadData();
  };

  const markAllAsRead = async () => {
    await Promise.all(
      notifications
        .filter((notification) => !notification.isRead)
        .map((notification) => updateNotification(notification.id, { isRead: true }))
    );
    toast.success('All notifications marked as read');
    await loadData();
  };

  const getNotificationIcon = (type: Notification['type']) => {
    const icons = {
      maintenance: Wrench,
      insurance: FileText,
      license: User,
      fuel: Fuel,
      incident: AlertTriangle,
      general: Bell,
    };
    const Icon = icons[type];
    return <Icon className="w-5 h-5" />;
  };

  const getNotificationColor = (type: Notification['type']) => {
    const colors = {
      maintenance: 'bg-[#eef0f8] text-[#15247f]',
      insurance: 'bg-[#eaf7f0] text-[#21895a]',
      license: 'bg-[#eef0f8] text-[#15247f]',
      fuel: 'bg-amber-100 text-amber-600',
      incident: 'bg-red-100 text-red-600',
      general: 'bg-gray-100 text-gray-600',
    };
    return colors[type];
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="lfz-enter flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.035em] text-gray-900 sm:text-[2.25rem]">Notifications</h1>
          <p className="mt-1.5 text-sm text-gray-500">
            {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All caught up!'}
          </p>
        </div>
        {canManageRecords && unreadCount > 0 && (
          <Button variant="outline" onClick={markAllAsRead}>
            <Check className="w-4 h-4 mr-2" />
            Mark All as Read
          </Button>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold">{notifications.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Unread</p>
            <p className="text-2xl font-bold text-[#15247f]">{unreadCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Read</p>
            <p className="text-2xl font-bold text-green-600">
              {notifications.filter((n) => n.isRead).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-500">Alerts</p>
            <p className="text-2xl font-bold text-amber-600">
              {notifications.filter((n) => n.type === 'maintenance' || n.type === 'insurance').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Notifications table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Notifications</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Related To</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notifications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    No notifications
                  </TableCell>
                </TableRow>
              ) : (
                notifications.map((notification) => {
                  const vehicle = notification.vehicleId
                    ? vehicles.find((v) => v.id === notification.vehicleId)
                    : null;
                  const driver = notification.driverId
                    ? drivers.find((d) => d.id === notification.driverId)
                    : null;

                  return (
                    <TableRow
                      key={notification.id}
                      className={notification.isRead ? '' : 'bg-[#f5f6fb]'}
                    >
                      <TableCell>
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-full ${getNotificationColor(
                            notification.type
                          )}`}
                        >
                          {getNotificationIcon(notification.type)}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{notification.title}</TableCell>
                      <TableCell className="max-w-xs truncate">{notification.message}</TableCell>
                      <TableCell>
                        {vehicle && (
                          <Link to={`/vehicles/${vehicle.id}`}>
                            <Badge variant="outline" className="cursor-pointer hover:bg-gray-100">
                              {vehicle.plateNumber}
                            </Badge>
                          </Link>
                        )}
                        {driver && (
                          <Link to={`/drivers/${driver.id}`}>
                            <Badge variant="outline" className="cursor-pointer hover:bg-gray-100">
                              {driver.fullName}
                            </Badge>
                          </Link>
                        )}
                      </TableCell>
                      <TableCell>{format(new Date(notification.createdAt), 'MMM d, yyyy')}</TableCell>
                      <TableCell>
                        {notification.isRead ? (
                          <Badge variant="secondary">Read</Badge>
                        ) : (
                          <Badge variant="default">Unread</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {canManageRecords && !notification.isRead && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => markAsRead(notification.id)}
                              title="Mark as read"
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
