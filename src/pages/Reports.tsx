import { useState, useEffect } from 'react';
import type { Vehicle } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Car, FileText } from 'lucide-react';
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

export default function Reports() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<string>('all');
  const [reportData, setReportData] = useState<any>(null);

  useEffect(() => {
    void loadReportData('all');
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

  const loadReportData = async (vehicleId: string) => {
    const [allVehicles, fuelLogs, maintenance, incidents, trips] = await Promise.all([
      listOperationalVehicles(),
      listFuelLogs(),
      listMaintenance(),
      listIncidents(),
      listTrips(),
    ]);

    setVehicles(allVehicles);

    let filteredFuel = fuelLogs;
    let filteredMaint = maintenance;
    let filteredIncidents = incidents;
    let filteredTrips = trips;

    if (vehicleId !== 'all') {
      filteredFuel = fuelLogs.filter((f) => f.vehicleId === vehicleId);
      filteredMaint = maintenance.filter((m) => m.vehicleId === vehicleId);
      filteredIncidents = incidents.filter((i) => i.vehicleId === vehicleId);
      filteredTrips = trips.filter((t) => t.vehicleId === vehicleId);
    }

    // Calculate stats
    const totalFuelCost = filteredFuel.reduce((sum, f) => sum + f.cost, 0);
    const totalFuelLiters = filteredFuel.reduce((sum, f) => sum + f.liters, 0);
    const totalMaintenanceCost = filteredMaint.reduce((sum, m) => sum + m.cost, 0);
    const totalIncidentCost = filteredIncidents.reduce(
      (sum, i) => sum + (i.finalRepairCost || i.repairCost),
      0
    );
    const totalDistance = filteredTrips.reduce((sum, t) => sum + t.distance, 0);

    // Cost breakdown for pie chart
    const costBreakdown = [
      { name: 'Fuel', value: totalFuelCost },
      { name: 'Maintenance', value: totalMaintenanceCost },
      { name: 'Incidents', value: totalIncidentCost },
    ].filter((item) => item.value > 0);

    // Monthly costs for bar chart
    const months = getLastSixMonths();
    const monthlyData = months.map(({ label, month, year }) => {
      const monthFuel = filteredFuel
        .filter((f) => {
          const date = new Date(f.date);
          return date.getMonth() === month && date.getFullYear() === year;
        })
        .reduce((sum, f) => sum + f.cost, 0);
      const monthMaint = filteredMaint
        .filter((m) => {
          const date = new Date(m.scheduledDate);
          return date.getMonth() === month && date.getFullYear() === year;
        })
        .reduce((sum, m) => sum + m.cost, 0);
      return {
        month: label,
        fuel: monthFuel / 1000,
        maintenance: monthMaint / 1000,
      };
    });

    // Vehicle performance comparison
    const vehiclePerformance = allVehicles.map((v) => {
      const vFuel = fuelLogs.filter((f) => f.vehicleId === v.id).reduce((sum, f) => sum + f.cost, 0);
      const vMaint = maintenance.filter((m) => m.vehicleId === v.id).reduce((sum, m) => sum + m.cost, 0);
      const vTrips = trips.filter((t) => t.vehicleId === v.id).reduce((sum, t) => sum + t.distance, 0);
      return {
        name: v.plateNumber,
        fuel: vFuel / 1000,
        maintenance: vMaint / 1000,
        distance: vTrips,
      };
    });

    setReportData({
      totalFuelCost,
      totalFuelLiters,
      totalMaintenanceCost,
      totalIncidentCost,
      totalDistance,
      costBreakdown,
      monthlyData,
      vehiclePerformance,
    });
  };

  const handleVehicleChange = (value: string) => {
    setSelectedVehicle(value);
    void loadReportData(value);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-500">Fleet performance and cost analysis</p>
        </div>
        <Select value={selectedVehicle} onValueChange={handleVehicleChange}>
          <SelectTrigger className="w-64">
            <Car className="w-4 h-4 mr-2" />
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

      {reportData && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-green-500" />
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
                  <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-500" />
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
                  <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-red-500" />
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
                  <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Distance</p>
                    <p className="text-xl font-bold">{reportData.totalDistance.toLocaleString()} km</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cost breakdown */}
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
                        {reportData.costBreakdown.map((_entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-4 mt-4">
                  {reportData.costBreakdown.map((entry: any, index: number) => (
                    <div key={entry.name} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
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

            {/* Monthly trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Monthly Cost Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportData.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value: any) => `₦${value}k`} />
                      <Bar dataKey="fuel" fill="#10b981" name="Fuel (₦k)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="maintenance" fill="#3b82f6" name="Maintenance (₦k)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Vehicle comparison */}
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

          {/* Key metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Key Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-1">Cost per Kilometer</p>
                  <p className="text-2xl font-bold">
                    {reportData.totalDistance > 0
                      ? formatCurrency(
                          (reportData.totalFuelCost +
                            reportData.totalMaintenanceCost +
                            reportData.totalIncidentCost) /
                            reportData.totalDistance
                        )
                      : '₦0'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-1">Fuel Efficiency</p>
                  <p className="text-2xl font-bold">
                    {reportData.totalDistance > 0 && reportData.totalFuelLiters > 0
                      ? `${(
                          (reportData.totalFuelLiters / reportData.totalDistance) *
                          100
                        ).toFixed(1)} L/100km`
                      : 'N/A'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-1">Total Cost of Ownership</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(
                      reportData.totalFuelCost +
                        reportData.totalMaintenanceCost +
                        reportData.totalIncidentCost
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
