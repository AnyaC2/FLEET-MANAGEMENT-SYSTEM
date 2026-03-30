import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Maintenance, Notification, Vehicle } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Car,
  Users,
  Fuel,
  Wrench,
  TrendingUp,
  ArrowRight,
  Bell,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  listDrivers,
  listFuelLogs,
  listMaintenance,
  listNotifications,
  listVehicles,
} from '@/lib/fleet-data';

const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6b7280'];

export default function Dashboard() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [stats, setStats] = useState({
    totalVehicles: 0,
    activeVehicles: 0,
    idleVehicles: 0,
    maintenanceVehicles: 0,
    totalDrivers: 0,
    activeDrivers: 0,
    totalFuelCost: 0,
    totalMaintenanceCost: 0,
    monthlyFuelCost: 0,
    monthlyMaintenanceCost: 0,
    upcomingMaintenance: 0,
    overdueMaintenance: 0,
    unreadNotifications: 0,
  });
  const [recentMaintenance, setRecentMaintenance] = useState<Maintenance[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [fuelData, setFuelData] = useState<any[]>([]);
  const [vehicleStatusData, setVehicleStatusData] = useState<any[]>([]);

  useEffect(() => {
    void loadDashboardData();
  }, []);

  const getLastSixMonths = () => {
    const formatter = new Intl.DateTimeFormat('en-US', { month: 'short' });
    const now = new Date();

    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      return {
        label: formatter.format(date),
        month: date.getMonth(),
        year: date.getFullYear(),
      };
    });
  };

  const loadDashboardData = async () => {
    // Vehicles
    const [vehicles, drivers, fuelLogs, maintenance, allNotifications] = await Promise.all([
      listVehicles(),
      listDrivers(),
      listFuelLogs(),
      listMaintenance(),
      listNotifications(),
    ]);
    const activeVehicles = vehicles.filter((v) => v.status === 'Active');
    const idleVehicles = vehicles.filter((v) => v.status === 'Idle');
    const maintenanceVehicles = vehicles.filter((v) => v.status === 'Under Maintenance');

    // Drivers
    const activeDrivers = drivers.filter((d) => d.status === 'Active');

    // Fuel logs
    const totalFuelCost = fuelLogs.reduce((sum, f) => sum + f.cost, 0);
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyFuelLogs = fuelLogs.filter((f) => {
      const date = new Date(f.date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });
    const monthlyFuelCost = monthlyFuelLogs.reduce((sum, f) => sum + f.cost, 0);

    // Maintenance
    const totalMaintenanceCost = maintenance.reduce((sum, m) => sum + m.cost, 0);
    const monthlyMaintenance = maintenance.filter((m) => {
      const date = new Date(m.scheduledDate);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });
    const monthlyMaintenanceCost = monthlyMaintenance.reduce((sum, m) => sum + m.cost, 0);

    const upcomingMaintenance = maintenance.filter(
      (m) => m.status === 'Scheduled'
    ).length;
    const overdueMaintenance = maintenance.filter(
      (m) => m.status === 'Overdue'
    ).length;

    // Recent maintenance
    const recentMaint = maintenance
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    // Notifications
    const unreadNotifications = allNotifications.filter((n) => !n.isRead).length;
    const recentNotifications = allNotifications
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    // Fuel chart data (last 6 months)
    const months = getLastSixMonths();
    const fuelChartData = months.map(({ label, month, year }) => {
      const monthFuel = fuelLogs.filter((f) => {
        const date = new Date(f.date);
        return date.getMonth() === month && date.getFullYear() === year;
      });
      return {
        month: label,
        cost: monthFuel.reduce((sum, f) => sum + f.cost, 0) / 1000,
      };
    });

    // Vehicle status chart data
    const vehicleStatusChart = [
      { name: 'Active', value: activeVehicles.length },
      { name: 'Idle', value: idleVehicles.length },
      { name: 'Maintenance', value: maintenanceVehicles.length },
      { name: 'Decommissioned', value: vehicles.filter((v) => v.status === 'Decommissioned').length },
    ];

    setStats({
      totalVehicles: vehicles.length,
      activeVehicles: activeVehicles.length,
      idleVehicles: idleVehicles.length,
      maintenanceVehicles: maintenanceVehicles.length,
      totalDrivers: drivers.length,
      activeDrivers: activeDrivers.length,
      totalFuelCost,
      totalMaintenanceCost,
      monthlyFuelCost,
      monthlyMaintenanceCost,
      upcomingMaintenance,
      overdueMaintenance,
      unreadNotifications,
    });
    setVehicles(vehicles);
    setRecentMaintenance(recentMaint);
    setNotifications(recentNotifications);
    setFuelData(fuelChartData);
    setVehicleStatusData(vehicleStatusChart);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Overview of your fleet performance</p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Vehicles</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalVehicles}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="default" className="text-xs bg-green-500">
                    {stats.activeVehicles} Active
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {stats.idleVehicles} Idle
                  </Badge>
                </div>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Car className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Drivers</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalDrivers}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="default" className="text-xs bg-green-500">
                    {stats.activeDrivers} Active
                  </Badge>
                </div>
              </div>
              <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Monthly Fuel Cost</p>
                <p className="text-3xl font-bold text-gray-900">
                  ₦{(stats.monthlyFuelCost / 1000).toFixed(0)}k
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-500">This month</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center">
                <Fuel className="w-6 h-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Maintenance Cost</p>
                <p className="text-3xl font-bold text-gray-900">
                  ₦{(stats.monthlyMaintenanceCost / 1000).toFixed(0)}k
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {stats.upcomingMaintenance > 0 && (
                    <Badge variant="secondary" className="text-xs bg-amber-500 text-white">
                      {stats.upcomingMaintenance} Scheduled
                    </Badge>
                  )}
                  {stats.overdueMaintenance > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {stats.overdueMaintenance} Overdue
                    </Badge>
                  )}
                </div>
              </div>
              <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center">
                <Wrench className="w-6 h-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fuel consumption chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Fuel Consumption Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fuelData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: any) => `₦${value}k`}
                    labelFormatter={(label) => `${label}`}
                  />
                  <Bar dataKey="cost" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Vehicle status chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Vehicle Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={vehicleStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {vehicleStatusData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-4">
              {vehicleStatusData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm text-gray-600">
                    {entry.name} ({entry.value})
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Maintenance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Maintenance</CardTitle>
            <Link to="/maintenance">
              <Button variant="ghost" size="sm">
                View All
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentMaintenance.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No maintenance records</p>
              ) : (
                recentMaintenance.map((maint) => {
                  const vehicle = vehicles.find((item) => item.id === maint.vehicleId);
                  return (
                    <div
                      key={maint.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{maint.serviceType}</p>
                        <p className="text-sm text-gray-500">
                          {vehicle?.plateNumber} • {maint.serviceProvider}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">
                          {formatCurrency(maint.cost)}
                        </p>
                        <Badge
                          variant={
                            maint.status === 'Completed'
                              ? 'default'
                              : maint.status === 'In Progress'
                              ? 'secondary'
                              : maint.status === 'Overdue'
                              ? 'destructive'
                              : 'outline'
                          }
                          className={
                            maint.status === 'Completed'
                              ? 'bg-green-500'
                              : maint.status === 'In Progress'
                              ? 'bg-amber-500 text-white'
                              : ''
                          }
                        >
                          {maint.status}
                        </Badge>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Notifications */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Notifications</CardTitle>
            <Link to="/notifications">
              <Button variant="ghost" size="sm">
                View All
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {notifications.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No notifications</p>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`flex items-start gap-3 p-3 rounded-lg ${
                      notif.isRead ? 'bg-gray-50' : 'bg-blue-50'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        notif.isRead ? 'bg-gray-200' : 'bg-blue-200'
                      }`}
                    >
                      <Bell
                        className={`w-4 h-4 ${notif.isRead ? 'text-gray-500' : 'text-blue-600'}`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium ${notif.isRead ? 'text-gray-700' : 'text-gray-900'}`}>
                        {notif.title}
                      </p>
                      <p className="text-sm text-gray-500 truncate">{notif.message}</p>
                    </div>
                    {!notif.isRead && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
