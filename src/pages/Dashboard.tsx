import { useEffect, useEffectEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Maintenance, Notification, Vehicle } from '@/types';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Car,
  Fuel,
  Route,
  Users,
  Wrench,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  listDrivers,
  listFuelLogs,
  listMaintenance,
  listNotifications,
  listVehicles,
} from '@/lib/fleet-data';
import { useAuth } from '@/context/AuthContext';

const STATUS_COLORS = ['#00864a', '#d99a12', '#ed1c24', '#a5aab5'];

interface FuelChartPoint {
  month: string;
  cost: number;
}

interface VehicleStatusPoint {
  name: string;
  value: number;
}

const maintenanceStatusClasses: Record<Maintenance['status'], string> = {
  Completed: 'bg-emerald-50 text-emerald-700',
  'In Progress': 'bg-[#eef0f8] text-[#15247f]',
  Scheduled: 'bg-amber-50 text-amber-700',
  Overdue: 'bg-red-50 text-red-700',
};

export default function Dashboard() {
  const { canManageRecords } = useAuth();
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
  const [fuelData, setFuelData] = useState<FuelChartPoint[]>([]);
  const [vehicleStatusData, setVehicleStatusData] = useState<VehicleStatusPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

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

  const loadDashboardData = useEffectEvent(async () => {
    const [vehicleRecords, drivers, fuelLogs, maintenance, allNotifications] = await Promise.all([
      listVehicles(),
      listDrivers(),
      listFuelLogs(),
      listMaintenance(),
      listNotifications(),
    ]);
    const activeVehicles = vehicleRecords.filter((vehicle) => vehicle.status === 'Active');
    const idleVehicles = vehicleRecords.filter((vehicle) => vehicle.status === 'Idle');
    const maintenanceVehicles = vehicleRecords.filter((vehicle) => vehicle.status === 'Under Maintenance');
    const activeDrivers = drivers.filter((driver) => driver.status === 'Active');

    const totalFuelCost = fuelLogs.reduce((sum, log) => sum + log.cost, 0);
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyFuelCost = fuelLogs
      .filter((log) => {
        const date = new Date(log.date);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      })
      .reduce((sum, log) => sum + log.cost, 0);

    const totalMaintenanceCost = maintenance.reduce((sum, record) => sum + record.cost, 0);
    const monthlyMaintenanceCost = maintenance
      .filter((record) => {
        const date = new Date(record.scheduledDate);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      })
      .reduce((sum, record) => sum + record.cost, 0);

    const recentMaint = [...maintenance]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
    const recentNotifications = [...allNotifications]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 4);

    const fuelChartData = getLastSixMonths().map(({ label, month, year }) => ({
      month: label,
      cost:
        fuelLogs
          .filter((log) => {
            const date = new Date(log.date);
            return date.getMonth() === month && date.getFullYear() === year;
          })
          .reduce((sum, log) => sum + log.cost, 0) / 1000,
    }));

    setStats({
      totalVehicles: vehicleRecords.length,
      activeVehicles: activeVehicles.length,
      idleVehicles: idleVehicles.length,
      maintenanceVehicles: maintenanceVehicles.length,
      totalDrivers: drivers.length,
      activeDrivers: activeDrivers.length,
      totalFuelCost,
      totalMaintenanceCost,
      monthlyFuelCost,
      monthlyMaintenanceCost,
      upcomingMaintenance: maintenance.filter((record) => record.status === 'Scheduled').length,
      overdueMaintenance: maintenance.filter((record) => record.status === 'Overdue').length,
      unreadNotifications: allNotifications.filter((notification) => !notification.isRead).length,
    });
    setVehicles(vehicleRecords);
    setRecentMaintenance(recentMaint);
    setNotifications(recentNotifications);
    setFuelData(fuelChartData);
    setVehicleStatusData([
      { name: 'Active', value: activeVehicles.length },
      { name: 'Idle', value: idleVehicles.length },
      { name: 'Maintenance', value: maintenanceVehicles.length },
      {
        name: 'Decommissioned',
        value: vehicleRecords.filter((vehicle) => vehicle.status === 'Decommissioned').length,
      },
    ]);
  });

  useEffect(() => {
    let cancelled = false;
    void loadDashboardData().catch((error) => {
      console.error('Could not load fleet overview.', error);
      if (!cancelled) setLoadError(true);
    }).finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      notation: amount >= 1_000_000 ? 'compact' : 'standard',
      maximumFractionDigits: amount >= 1_000_000 ? 1 : 0,
    }).format(amount);

  const formatDate = (value: string) =>
    new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short' }).format(new Date(value));

  const readinessRate = stats.totalVehicles
    ? Math.round((stats.activeVehicles / stats.totalVehicles) * 100)
    : 0;

  if (isLoading || loadError) {
    return (
      <section className="space-y-5">
        <h1 className="text-3xl font-semibold tracking-tight">Fleet overview</h1>
        <div className="lfz-panel rounded-xl p-8" role={loadError ? 'alert' : 'status'}>
          <p className="text-sm text-gray-600">{loadError ? 'Fleet records could not be loaded. Check your connection and try again.' : 'Loading fleet records...'}</p>
          {loadError && <Button className="mt-4" onClick={() => { setIsLoading(true); setLoadError(false); setReloadKey((key) => key + 1); }}>Try again</Button>}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <section className="lfz-enter flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.035em] text-[#171a1f] sm:text-[2.5rem]">
            Fleet overview
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
            Vehicle availability, monthly spending and outstanding service work.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {canManageRecords ? (
            <Button asChild variant="outline" className="h-10 border-gray-300 bg-white px-4 shadow-none">
              <Link to="/import">Import records</Link>
            </Button>
          ) : null}
          <Button asChild className="h-10 px-4">
            <Link to="/vehicles">
              View vehicles
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="lfz-enter lfz-enter-delay-1 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Link
          to="/vehicles"
          aria-label="View all registered vehicles"
          className="group relative min-h-40 overflow-hidden rounded-2xl bg-[#15247f] p-5 text-white shadow-[0_16px_38px_rgba(21,36,127,0.18)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ed1c24] focus-visible:ring-offset-2"
        >
          <div className="lfz-grid absolute inset-0 opacity-40" />
          <div className="relative flex h-full flex-col justify-between">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-blue-100/70">Registered fleet</p>
              <ArrowUpRight className="h-5 w-5 text-blue-100/65 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
            <div>
              <p className="text-4xl font-semibold tracking-[-0.04em]">{stats.totalVehicles}</p>
              <p className="mt-2 text-xs text-blue-100">{stats.activeVehicles} marked active</p>
            </div>
          </div>
        </Link>

        <MetricCard
          label="Active drivers"
          value={stats.activeDrivers}
          note={`${stats.totalDrivers} registered personnel`}
          icon={Users}
          accent="blue"
          to="/drivers?status=Active"
        />
        <MetricCard
          label="Fuel this month"
          value={formatCurrency(stats.monthlyFuelCost)}
          note={`${formatCurrency(stats.totalFuelCost)} recorded in total`}
          icon={Fuel}
          accent="blue"
          to="/fuel?period=month"
        />
        <MetricCard
          label="Maintenance this month"
          value={formatCurrency(stats.monthlyMaintenanceCost)}
          note={`${stats.upcomingMaintenance} scheduled · ${stats.overdueMaintenance} overdue`}
          icon={Wrench}
          accent={stats.overdueMaintenance > 0 ? 'red' : 'blue'}
          to={stats.overdueMaintenance > 0 ? '/maintenance?status=Overdue' : '/maintenance'}
        />
      </section>

      <section className="lfz-enter lfz-enter-delay-2 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
        <div className="lfz-panel rounded-2xl p-5 sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-base font-semibold tracking-tight text-gray-900">Monthly fuel spending</p>
              <p className="mt-1 text-xs text-gray-500">Monthly expenditure across the last six months</p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#f1f3fa] px-3 py-1.5 text-xs font-medium text-[#15247f]">
              <CalendarDays className="h-3.5 w-3.5" />
              Last 6 months
            </span>
          </div>

          <div className="mt-6 h-[290px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 720, height: 290 }}>
              <BarChart data={fuelData} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barCategoryGap="34%">
                <CartesianGrid vertical={false} stroke="#e7e9ee" strokeDasharray="3 4" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#7a808b', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9aa0aa', fontSize: 11 }} tickFormatter={(value) => `₦${value}k`} />
                <Tooltip
                  cursor={{ fill: '#f3f4f8', radius: 8 }}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e4e6eb', boxShadow: '0 12px 30px rgba(20, 29, 69, 0.10)' }}
                  formatter={(value) => [`₦${Number(value).toLocaleString()}k`, 'Fuel cost']}
                />
                <Bar dataKey="cost" fill="#15247f" radius={[4, 4, 0, 0]} maxBarSize={52} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 grid grid-cols-2 border-t border-gray-100 pt-4 sm:grid-cols-3">
            <CostSummary label="Fuel · all time" value={formatCurrency(stats.totalFuelCost)} to="/fuel" />
            <CostSummary label="Maintenance · all time" value={formatCurrency(stats.totalMaintenanceCost)} to="/maintenance" />
            <CostSummary label="Maintenance · this month" value={formatCurrency(stats.monthlyMaintenanceCost)} to="/maintenance?period=month" className="col-span-2 mt-4 sm:col-span-1 sm:mt-0" />
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-[#101a55] p-5 text-white shadow-[0_18px_42px_rgba(16,26,85,0.16)] sm:p-6">
          <div className="lfz-grid absolute inset-0 opacity-30" />
          <div className="relative">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-base font-semibold">Fleet readiness</p>
                <p className="mt-1 text-xs text-blue-100/55">Current vehicle availability</p>
              </div>
            </div>

            <div className="relative mx-auto mt-4 h-52 max-w-[250px]">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 250, height: 208 }}>
                <PieChart>
                  <Pie data={vehicleStatusData} cx="50%" cy="50%" innerRadius={68} outerRadius={88} paddingAngle={3} dataKey="value" stroke="none">
                    {vehicleStatusData.map((entry, index) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[index]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 10, border: 'none' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-semibold tracking-[-0.05em]">{stats.totalVehicles ? `${readinessRate}%` : '—'}</span>
                <span className="mt-1 text-xs text-blue-100">{stats.totalVehicles ? 'Active vehicles' : 'No vehicles yet'}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-5 gap-y-3 border-t border-white/10 pt-5">
              {vehicleStatusData.map((entry, index) => (
                <Link
                  key={entry.name}
                  to={`/vehicles?status=${encodeURIComponent(entry.name === 'Maintenance' ? 'Under Maintenance' : entry.name)}`}
                  className="flex items-center justify-between gap-3 rounded-md text-xs outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-white/70"
                >
                  <span className="flex items-center gap-2 text-blue-100/65">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[index] }} />
                    {entry.name}
                  </span>
                  <span className="font-semibold text-white">{entry.value}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="lfz-panel overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-5 sm:px-6">
            <div>
              <p className="text-base font-semibold tracking-tight text-gray-900">Maintenance register</p>
              <p className="mt-1 text-xs text-gray-500">Latest workshop and service activity</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-[#15247f] hover:bg-[#f1f3fa] hover:text-[#15247f]">
              <Link to="/maintenance">
                View all
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="overflow-x-auto">
            {recentMaintenance.length === 0 ? (
              <EmptyState icon={Wrench} label="No maintenance records yet" />
            ) : (
              <table className="w-full min-w-[650px] text-left">
                <thead>
                  <tr className="bg-[#fafafa] text-xs font-medium text-gray-600">
                    <th className="px-6 py-3">Service</th>
                    <th className="px-4 py-3">Vehicle</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentMaintenance.map((record) => {
                    const vehicle = vehicles.find((item) => item.id === record.vehicleId);
                    return (
                      <tr key={record.id} className="transition-colors hover:bg-[#fafbff]">
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-gray-900">{record.serviceType}</p>
                          <p className="mt-1 max-w-48 truncate text-xs text-gray-400">{record.serviceProvider || 'Internal workshop'}</p>
                        </td>
                        <td className="px-4 py-4 text-sm font-medium text-[#15247f]">{vehicle?.plateNumber || 'Unknown'}</td>
                        <td className="px-4 py-4 text-sm text-gray-500">{formatDate(record.scheduledDate)}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${maintenanceStatusClasses[record.status]}`}>
                            {record.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-semibold text-gray-900">{formatCurrency(record.cost)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="lfz-panel rounded-2xl p-5 sm:p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-base font-semibold tracking-tight text-gray-900">Recent notices</p>
              <p className="mt-1 text-xs text-gray-500">Recent operational notices</p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eef0f8] text-[#15247f]">
              <Bell className="h-[18px] w-[18px]" />
            </span>
          </div>

          <div className="mt-5 divide-y divide-gray-100">
            {notifications.length === 0 ? (
              <EmptyState icon={Bell} label="No notifications to review" compact />
            ) : (
              notifications.map((notification) => (
                <Link key={notification.id} to="/notifications" className="group flex gap-3 py-4 first:pt-0 last:pb-0">
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${notification.isRead ? 'bg-gray-300' : 'bg-[#ed1c24]'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-gray-900 group-hover:text-[#15247f]">{notification.title}</span>
                    <span className="mt-1 line-clamp-2 block text-xs leading-5 text-gray-500">{notification.message}</span>
                  </span>
                  <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-300 transition-colors group-hover:text-[#15247f]" />
                </Link>
              ))
            )}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 border-t border-gray-100 pt-5">
            <QuickLink to="/trips" icon={Route} label="Trip log" />
            <QuickLink to="/fuel" icon={Fuel} label="Fuel log" />
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  accent,
  to,
}: {
  label: string;
  value: string | number;
  note: string;
  icon: typeof Car;
  accent: 'blue' | 'amber' | 'red' | 'green';
  to: string;
}) {
  const accents = {
    blue: 'bg-[#eef0f8] text-[#15247f]',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-[#ed1c24]',
    green: 'bg-emerald-50 text-[#00864a]',
  };

  return (
    <Link
      to={to}
      aria-label={`Open ${label}`}
      className="lfz-panel group flex min-h-40 flex-col justify-between rounded-2xl p-5 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15247f] focus-visible:ring-offset-2"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-full ${accents[accent]}`}>
          <Icon className="h-[18px] w-[18px] transition-transform group-hover:scale-105" />
        </span>
      </div>
      <div>
        <p className="truncate text-[2rem] font-semibold tracking-[-0.045em] text-gray-900">{value}</p>
        <p className="mt-1 text-xs leading-5 text-gray-500">{note}</p>
      </div>
    </Link>
  );
}

function CostSummary({ label, value, to, className = '' }: { label: string; value: string; to: string; className?: string }) {
  return (
    <Link to={to} className={`group block rounded-lg outline-none sm:border-r sm:border-gray-100 sm:px-5 first:pl-0 last:border-r-0 focus-visible:ring-2 focus-visible:ring-[#15247f] ${className}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1.5 text-sm font-semibold text-gray-900 group-hover:text-[#15247f]">{value}</p>
    </Link>
  );
}

function QuickLink({ to, icon: Icon, label }: { to: string; icon: typeof Car; label: string }) {
  return (
    <Link to={to} className="flex items-center justify-between rounded-xl bg-[#f4f5f8] px-3 py-3 text-xs font-medium text-gray-700 transition-colors hover:bg-[#e9ecf7] hover:text-[#15247f]">
      <span className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}

function EmptyState({ icon: Icon, label, compact = false }: { icon: typeof Car; label: string; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center text-gray-400 ${compact ? 'py-8' : 'py-14'}`}>
      <Icon className="mb-2 h-5 w-5" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
