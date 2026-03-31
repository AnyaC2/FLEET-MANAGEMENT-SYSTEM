import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import type { FuelLog, Incident, Maintenance, Trip, Vehicle } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Car, CalendarRange, Download, FileText } from 'lucide-react';
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
  listFuelLogs,
  listIncidents,
  listMaintenance,
  listTrips,
  listOperationalVehicles,
} from '@/lib/fleet-data';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];
type PeriodPreset = '7d' | '30d' | '90d' | '365d' | 'all' | 'custom';

function formatBucketLabel(date: Date, granularity: 'day' | 'week' | 'month') {
  if (granularity === 'day') {
    return format(date, 'MMM d');
  }

  if (granularity === 'week') {
    return `Week of ${format(date, 'MMM d')}`;
  }

  return format(date, 'MMM yyyy');
}

export default function Reports() {
  const reportRef = useRef<HTMLDivElement | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string>('all');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('30d');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  useEffect(() => {
    void loadReportData();
  }, []);

  const loadReportData = async () => {
    const [allVehicles, fuel, maintenanceRecords, incidentRecords, tripRecords] = await Promise.all([
      listOperationalVehicles(),
      listFuelLogs(),
      listMaintenance(),
      listIncidents(),
      listTrips(),
    ]);

    setVehicles(allVehicles);
    setFuelLogs(fuel);
    setMaintenance(maintenanceRecords);
    setIncidents(incidentRecords);
    setTrips(tripRecords);
  };

  const activeRange = useMemo(() => {
    if (periodPreset === 'all') {
      return null;
    }

    if (periodPreset === 'custom') {
      if (!customStartDate || !customEndDate) {
        return null;
      }

      return {
        start: new Date(`${customStartDate}T00:00:00`),
        end: new Date(`${customEndDate}T23:59:59`),
      };
    }

    const end = new Date();
    const start = new Date();
    const days = Number.parseInt(periodPreset.replace('d', ''), 10);
    start.setDate(end.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }, [customEndDate, customStartDate, periodPreset]);

  const reportData = useMemo(() => {
    const inRange = (value: string) => {
      if (!activeRange) {
        return true;
      }

      const date = new Date(value);
      return date.getTime() >= activeRange.start.getTime() && date.getTime() <= activeRange.end.getTime();
    };

    let filteredFuel = fuelLogs.filter((item) => inRange(item.date));
    let filteredMaint = maintenance.filter((item) => inRange(item.scheduledDate));
    let filteredIncidents = incidents.filter((item) => inRange(item.date));
    let filteredTrips = trips.filter((item) => inRange(item.date));

    if (selectedVehicle !== 'all') {
      filteredFuel = filteredFuel.filter((item) => item.vehicleId === selectedVehicle);
      filteredMaint = filteredMaint.filter((item) => item.vehicleId === selectedVehicle);
      filteredIncidents = filteredIncidents.filter((item) => item.vehicleId === selectedVehicle);
      filteredTrips = filteredTrips.filter((item) => item.vehicleId === selectedVehicle);
    }

    const totalFuelCost = filteredFuel.reduce((sum, item) => sum + item.cost, 0);
    const totalFuelLiters = filteredFuel.reduce((sum, item) => sum + item.liters, 0);
    const totalMaintenanceCost = filteredMaint.reduce((sum, item) => sum + item.cost, 0);
    const totalIncidentCost = filteredIncidents.reduce(
      (sum, item) => sum + (item.finalRepairCost || item.repairCost),
      0
    );
    const totalDistance = filteredTrips.reduce((sum, item) => sum + item.distance, 0);

    const costBreakdown = [
      { name: 'Fuel', value: totalFuelCost },
      { name: 'Maintenance', value: totalMaintenanceCost },
      { name: 'Incidents', value: totalIncidentCost },
    ].filter((item) => item.value > 0);

    const trendStart = activeRange?.start ?? (() => {
      const dates = [
        ...filteredFuel.map((item) => new Date(item.date).getTime()),
        ...filteredMaint.map((item) => new Date(item.scheduledDate).getTime()),
      ];

      if (dates.length === 0) {
        const date = new Date();
        date.setDate(date.getDate() - 29);
        date.setHours(0, 0, 0, 0);
        return date;
      }

      return new Date(Math.min(...dates));
    })();
    const trendEnd = activeRange?.end ?? new Date();
    const daySpan = Math.max(
      1,
      Math.ceil((trendEnd.getTime() - trendStart.getTime()) / (1000 * 60 * 60 * 24))
    );
    const granularity: 'day' | 'week' | 'month' =
      daySpan <= 45 ? 'day' : daySpan <= 180 ? 'week' : 'month';

    const buckets: Array<{
      label: string;
      start: Date;
      end: Date;
    }> = [];

    if (granularity === 'day') {
      const cursor = new Date(trendStart);
      cursor.setHours(0, 0, 0, 0);
      while (cursor.getTime() <= trendEnd.getTime()) {
        const start = new Date(cursor);
        const end = new Date(cursor);
        end.setHours(23, 59, 59, 999);
        buckets.push({
          label: formatBucketLabel(start, granularity),
          start,
          end,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
    } else if (granularity === 'week') {
      const cursor = new Date(trendStart);
      cursor.setHours(0, 0, 0, 0);
      while (cursor.getTime() <= trendEnd.getTime()) {
        const start = new Date(cursor);
        const end = new Date(cursor);
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        buckets.push({
          label: formatBucketLabel(start, granularity),
          start,
          end,
        });
        cursor.setDate(cursor.getDate() + 7);
      }
    } else {
      const cursor = new Date(trendStart.getFullYear(), trendStart.getMonth(), 1);
      while (cursor.getTime() <= trendEnd.getTime()) {
        const start = new Date(cursor);
        const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
        buckets.push({
          label: formatBucketLabel(start, granularity),
          start,
          end,
        });
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }

    const trendData = buckets.map((bucket) => {
      const bucketFuel = filteredFuel
        .filter((item) => {
          const date = new Date(item.date);
          return date.getTime() >= bucket.start.getTime() && date.getTime() <= bucket.end.getTime();
        })
        .reduce((sum, item) => sum + item.cost, 0);

      const bucketMaintenance = filteredMaint
        .filter((item) => {
          const date = new Date(item.scheduledDate);
          return date.getTime() >= bucket.start.getTime() && date.getTime() <= bucket.end.getTime();
        })
        .reduce((sum, item) => sum + item.cost, 0);

      return {
        period: bucket.label,
        fuel: bucketFuel / 1000,
        maintenance: bucketMaintenance / 1000,
      };
    });

    const comparisonSource =
      selectedVehicle === 'all' ? vehicles : vehicles.filter((vehicle) => vehicle.id === selectedVehicle);

    const vehiclePerformance = comparisonSource.map((vehicle) => {
      const vehicleFuel = filteredFuel
        .filter((item) => item.vehicleId === vehicle.id)
        .reduce((sum, item) => sum + item.cost, 0);
      const vehicleMaint = filteredMaint
        .filter((item) => item.vehicleId === vehicle.id)
        .reduce((sum, item) => sum + item.cost, 0);
      const vehicleTrips = filteredTrips
        .filter((item) => item.vehicleId === vehicle.id)
        .reduce((sum, item) => sum + item.distance, 0);

      return {
        name: vehicle.plateNumber,
        fuel: vehicleFuel / 1000,
        maintenance: vehicleMaint / 1000,
        distance: vehicleTrips,
      };
    });

    return {
      totalFuelCost,
      totalFuelLiters,
      totalMaintenanceCost,
      totalIncidentCost,
      totalDistance,
      costBreakdown,
      trendData,
      vehiclePerformance,
    };
  }, [activeRange, fuelLogs, incidents, maintenance, periodPreset, selectedVehicle, trips, vehicles]);

  const handleExportPdf = () => {
    if (!reportRef.current) {
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1280,height=900');
    if (!printWindow) {
      return;
    }

    const headMarkup = Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((node) => node.outerHTML)
      .join('\n');

    printWindow.document.write(`
      <html>
        <head>
          <title>LFZDC Fleet Report</title>
          ${headMarkup}
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
            h1, h2, h3, p { margin: 0; }
            .report-shell { display: flex; flex-direction: column; gap: 24px; }
            .report-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
            .summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
            .metric-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; }
            .card { border: 1px solid #e5e7eb; border-radius: 16px; padding: 20px; break-inside: avoid; }
            .muted { color: #6b7280; font-size: 13px; }
            .value { font-size: 28px; font-weight: 700; margin-top: 8px; }
            @media print {
              body { margin: 12px; }
            }
          </style>
        </head>
        <body>
          <div class="report-shell">${reportRef.current.innerHTML}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);

  const rangeLabel = useMemo(() => {
    if (periodPreset === 'all') {
      return 'All recorded data';
    }

    if (periodPreset === 'custom') {
      if (!customStartDate || !customEndDate) {
        return 'Custom range';
      }
      return `${format(new Date(customStartDate), 'MMM d, yyyy')} - ${format(new Date(customEndDate), 'MMM d, yyyy')}`;
    }

    const labels: Record<Exclude<PeriodPreset, 'custom'>, string> = {
      '7d': 'Last 7 days',
      '30d': 'Last 30 days',
      '90d': 'Last 90 days',
      '365d': 'Last 12 months',
      all: 'All recorded data',
    };

    return labels[periodPreset];
  }, [customEndDate, customStartDate, periodPreset]);

  const fuelEfficiency =
    reportData.totalDistance > 0 && reportData.totalFuelLiters > 0
      ? `${((reportData.totalFuelLiters / reportData.totalDistance) * 100).toFixed(1)} L/100km`
      : 'N/A';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-500">Build filtered fleet reports and export the current report view as PDF.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={handleExportPdf}>
            <Download className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarRange className="h-5 w-5" />
            Report Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label>Vehicle</Label>
            <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
              <SelectTrigger>
                <Car className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Select vehicle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vehicles</SelectItem>
                {vehicles.map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>
                    {vehicle.plateNumber} - {vehicle.brand} {vehicle.model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Period</Label>
            <Select value={periodPreset} onValueChange={(value) => setPeriodPreset(value as PeriodPreset)}>
              <SelectTrigger>
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="365d">Last 12 months</SelectItem>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-start-date">Start Date</Label>
            <Input
              id="report-start-date"
              type="date"
              value={customStartDate}
              disabled={periodPreset !== 'custom'}
              onChange={(event) => setCustomStartDate(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-end-date">End Date</Label>
            <Input
              id="report-end-date"
              type="date"
              value={customEndDate}
              disabled={periodPreset !== 'custom'}
              onChange={(event) => setCustomEndDate(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div ref={reportRef} className="space-y-6">
        <Card>
          <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-wide text-gray-400">Current Report</p>
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedVehicle === 'all'
                  ? 'Fleet-wide summary'
                  : vehicles.find((vehicle) => vehicle.id === selectedVehicle)?.plateNumber ?? 'Vehicle report'}
              </h2>
            </div>
            <div className="text-sm text-gray-500">
              <p>{rangeLabel}</p>
              <p>Generated {format(new Date(), 'MMM d, yyyy h:mm a')}</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                  <FileText className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Fuel Cost</p>
                  <p className="text-xl font-bold">{formatCurrency(reportData.totalFuelCost)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                  <FileText className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Maintenance</p>
                  <p className="text-xl font-bold">{formatCurrency(reportData.totalMaintenanceCost)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                  <FileText className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Incidents</p>
                  <p className="text-xl font-bold">{formatCurrency(reportData.totalIncidentCost)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                  <FileText className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Distance</p>
                  <p className="text-xl font-bold">{reportData.totalDistance.toLocaleString()} km</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cost Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={reportData.costBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {reportData.costBreakdown.map((entry: { name: string }, index: number) => (
                        <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex flex-wrap justify-center gap-4">
                {reportData.costBreakdown.map((entry: { name: string; value: number }, index: number) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-sm text-gray-600">
                      {entry.name} ({formatCurrency(entry.value)})
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cost Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData.trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip formatter={(value) => `₦${Number(value ?? 0)}k`} />
                    <Bar dataKey="fuel" fill="#10b981" name="Fuel (₦k)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="maintenance" fill="#3b82f6" name="Maintenance (₦k)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {selectedVehicle === 'all' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Vehicle Performance Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData.vehiclePerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="fuel" fill="#10b981" name="Fuel Cost (₦k)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="maintenance" fill="#3b82f6" name="Maintenance (₦k)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Key Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div className="text-center">
                <p className="mb-1 text-sm text-gray-500">Cost per Kilometer</p>
                <p className="text-2xl font-bold">
                  {reportData.totalDistance > 0
                    ? formatCurrency(
                        (reportData.totalFuelCost + reportData.totalMaintenanceCost + reportData.totalIncidentCost) /
                          reportData.totalDistance
                      )
                    : '₦0'}
                </p>
              </div>
              <div className="text-center">
                <p className="mb-1 text-sm text-gray-500">Fuel Efficiency</p>
                <p className="text-2xl font-bold">{fuelEfficiency}</p>
              </div>
              <div className="text-center">
                <p className="mb-1 text-sm text-gray-500">Total Cost of Ownership</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(
                    reportData.totalFuelCost + reportData.totalMaintenanceCost + reportData.totalIncidentCost
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
