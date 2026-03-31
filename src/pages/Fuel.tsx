import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { FuelLog, Vehicle } from '@/types';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, FuelIcon, TrendingUp, Droplets, Download } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { createFuelLog, listFuelLogs, listOperationalVehicles } from '@/lib/fleet-data';
import { exportWorkbook } from '@/lib/excel-export';
import { dateFallsInRange, resolveDateRange, type PeriodPreset } from '@/lib/report-filters';

export default function Fuel() {
  const { canManageRecords } = useAuth();
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);
  const [reportPreset, setReportPreset] = useState<PeriodPreset>('30d');
  const [reportVehicleId, setReportVehicleId] = useState('all');
  const [reportType, setReportType] = useState<'transactions' | 'vehicle_summary' | 'spend_summary'>('transactions');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    vehicleId: '',
    date: new Date().toISOString().split('T')[0],
    liters: '',
    cost: '',
    odometer: '',
    station: '',
  });

  useEffect(() => {
    void loadData();
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

  const loadData = async () => {
    const logs = await listFuelLogs();
    const sortedLogs = logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setFuelLogs(sortedLogs);

    const allVehicles = await listOperationalVehicles();
    setVehicles(allVehicles);

    // Prepare chart data (last 6 months)
    const months = getLastSixMonths();
    const data = months.map(({ label, month, year }) => {
      const monthLogs = logs.filter((log) => {
        const date = new Date(log.date);
        return date.getMonth() === month && date.getFullYear() === year;
      });
      return {
        month: label,
        liters: monthLogs.reduce((sum, log) => sum + log.liters, 0),
        cost: monthLogs.reduce((sum, log) => sum + log.cost, 0) / 1000,
      };
    });
    setChartData(data);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validation
      if (!formData.vehicleId || !formData.date || !formData.liters || !formData.cost || !formData.odometer) {
        toast.error('Please fill in all required fields');
        setIsSubmitting(false);
        return;
      }

      const liters = parseFloat(formData.liters);
      const cost = parseFloat(formData.cost);
      const odometer = parseInt(formData.odometer);

      if (isNaN(liters) || isNaN(cost) || isNaN(odometer)) {
        toast.error('Please enter valid numbers');
        setIsSubmitting(false);
        return;
      }

      // Check odometer is increasing
      const previousLogs = fuelLogs.filter((log) => log.vehicleId === formData.vehicleId);
      const lastLog = previousLogs.sort((a, b) => b.odometer - a.odometer)[0];
      if (lastLog && odometer < lastLog.odometer) {
        toast.error('Odometer reading must be greater than the previous reading');
        setIsSubmitting(false);
        return;
      }

      const newFuelLog: FuelLog = {
        id: `fuel-${Date.now()}`,
        vehicleId: formData.vehicleId,
        date: formData.date,
        liters,
        cost,
        odometer,
        station: formData.station || undefined,
        createdAt: new Date().toISOString(),
      };

      await createFuelLog(newFuelLog);
      toast.success('Fuel purchase logged successfully');
      setIsAddModalOpen(false);
      resetForm();
      await loadData();
    } catch (error) {
      console.error('Failed to log fuel purchase', error);
      toast.error('Failed to log fuel purchase');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      vehicleId: '',
      date: new Date().toISOString().split('T')[0],
      liters: '',
      cost: '',
      odometer: '',
      station: '',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate stats
  const totalCost = fuelLogs.reduce((sum, log) => sum + log.cost, 0);
  const totalLiters = fuelLogs.reduce((sum, log) => sum + log.liters, 0);
  const avgCostPerLiter = totalLiters > 0 ? totalCost / totalLiters : 0;

  const handleExportFuelReport = () => {
    try {
      const range = resolveDateRange({
        preset: reportPreset,
        customStartDate,
        customEndDate,
      });

      const filteredLogs = fuelLogs.filter((log) => {
        const matchesVehicle = reportVehicleId === 'all' || log.vehicleId === reportVehicleId;
        const matchesRange = dateFallsInRange(log.date, range);
        return matchesVehicle && matchesRange;
      });

      let rows: Array<Record<string, string | number>> = [];
      let reportName = 'fuel-transactions';

      if (reportType === 'transactions') {
        rows = filteredLogs.map((log) => {
          const vehicle = vehicles.find((item) => item.id === log.vehicleId);
          return {
            Date: format(new Date(log.date), 'MMM d, yyyy'),
            'Plate Number': vehicle?.plateNumber ?? '-',
            Vehicle: vehicle ? `${vehicle.brand} ${vehicle.model}` : '-',
            Liters: log.liters,
            'Cost (NGN)': log.cost,
            'Odometer (km)': log.odometer,
            Station: log.station ?? '-',
          };
        });
      }

      if (reportType === 'vehicle_summary') {
        reportName = 'fuel-summary-by-vehicle';
        rows = vehicles
          .map((vehicle) => {
            const vehicleLogs = filteredLogs.filter((log) => log.vehicleId === vehicle.id);
            const totalVehicleLiters = vehicleLogs.reduce((sum, log) => sum + log.liters, 0);
            const totalVehicleCost = vehicleLogs.reduce((sum, log) => sum + log.cost, 0);
            return {
              'Plate Number': vehicle.plateNumber,
              Vehicle: `${vehicle.brand} ${vehicle.model}`,
              'Purchases Count': vehicleLogs.length,
              'Total Liters': totalVehicleLiters,
              'Total Cost (NGN)': totalVehicleCost,
              'Average Cost per Liter (NGN)': totalVehicleLiters > 0 ? Number((totalVehicleCost / totalVehicleLiters).toFixed(2)) : 0,
            };
          })
          .filter((row) => row['Purchases Count'] > 0);
      }

      if (reportType === 'spend_summary') {
        reportName = 'fuel-spend-summary';
        const totalSpend = filteredLogs.reduce((sum, log) => sum + log.cost, 0);
        const totalConsumed = filteredLogs.reduce((sum, log) => sum + log.liters, 0);
        rows = [
          {
            Period:
              reportPreset === 'custom' && customStartDate && customEndDate
                ? `${customStartDate} to ${customEndDate}`
                : reportPreset === 'all'
                  ? 'All time'
                  : reportPreset,
            Vehicle:
              reportVehicleId === 'all'
                ? 'All vehicles'
                : vehicles.find((vehicle) => vehicle.id === reportVehicleId)?.plateNumber ?? reportVehicleId,
            'Fuel Purchases': filteredLogs.length,
            'Total Liters': totalConsumed,
            'Total Cost (NGN)': totalSpend,
            'Average Cost per Liter (NGN)': totalConsumed > 0 ? Number((totalSpend / totalConsumed).toFixed(2)) : 0,
          },
        ];
      }

      exportWorkbook({
        filename: `${reportName}-${new Date().toISOString().split('T')[0]}.xlsx`,
        sheets: [
          {
            name: 'Fuel Report',
            rows,
          },
        ],
      });

      setIsReportModalOpen(false);
      toast.success('Fuel report downloaded');
    } catch (error) {
      console.error('Failed to export fuel report', error);
      toast.error('Failed to export fuel report');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fuel Management</h1>
          <p className="text-gray-500">Track fuel purchases and consumption</p>
        </div>
        <div className="flex gap-3">
          <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
            <Button variant="outline" onClick={() => setIsReportModalOpen(true)}>
              <Download className="w-4 h-4 mr-2" />
              Generate Report
            </Button>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Fuel Report</DialogTitle>
                <DialogDescription>
                  Generate downloadable Excel reports for fuel spending and consumption.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Report Type</Label>
                  <Select value={reportType} onValueChange={(value) => setReportType(value as typeof reportType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transactions">Fuel purchases in period</SelectItem>
                      <SelectItem value="vehicle_summary">Fuel summary by vehicle</SelectItem>
                      <SelectItem value="spend_summary">Overall spend summary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Period</Label>
                  <Select value={reportPreset} onValueChange={(value) => setReportPreset(value as PeriodPreset)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7d">Last 7 days</SelectItem>
                      <SelectItem value="30d">Last 30 days</SelectItem>
                      <SelectItem value="60d">Last 60 days</SelectItem>
                      <SelectItem value="90d">Last 90 days</SelectItem>
                      <SelectItem value="365d">Last 12 months</SelectItem>
                      <SelectItem value="all">All time</SelectItem>
                      <SelectItem value="custom">Custom range</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {reportPreset === 'custom' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fuelReportStartDate">Start Date</Label>
                      <Input id="fuelReportStartDate" type="date" value={customStartDate} onChange={(event) => setCustomStartDate(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fuelReportEndDate">End Date</Label>
                      <Input id="fuelReportEndDate" type="date" value={customEndDate} onChange={(event) => setCustomEndDate(event.target.value)} />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Vehicle</Label>
                  <Select value={reportVehicleId} onValueChange={setReportVehicleId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All vehicles</SelectItem>
                      {vehicles.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                          {vehicle.plateNumber} - {vehicle.brand} {vehicle.model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsReportModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleExportFuelReport}>
                  Download Excel
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            {canManageRecords && (
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Log Fuel Purchase
              </Button>
            </DialogTrigger>
          )}
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Log Fuel Purchase</DialogTitle>
              <DialogDescription>
                Record a new fuel purchase for a vehicle.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="vehicleId">Vehicle *</Label>
                  <Select
                    value={formData.vehicleId}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, vehicleId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map((vehicle) => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                          {vehicle.plateNumber} - {vehicle.brand} {vehicle.model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Date *</Label>
                  <Input
                    id="date"
                    name="date"
                    type="date"
                    value={formData.date}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="odometer">Odometer Reading (km) *</Label>
                  <Input
                    id="odometer"
                    name="odometer"
                    type="number"
                    value={formData.odometer}
                    onChange={handleInputChange}
                    placeholder="e.g., 15000"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="liters">Liters *</Label>
                    <Input
                      id="liters"
                      name="liters"
                      type="number"
                      step="0.01"
                      value={formData.liters}
                      onChange={handleInputChange}
                      placeholder="e.g., 50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cost">Cost (₦) *</Label>
                    <Input
                      id="cost"
                      name="cost"
                      type="number"
                      value={formData.cost}
                      onChange={handleInputChange}
                      placeholder="e.g., 40000"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="station">Station</Label>
                  <Input
                    id="station"
                    name="station"
                    value={formData.station}
                    onChange={handleInputChange}
                    placeholder="e.g., Total Lekki"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Logging...' : 'Log Fuel Purchase'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Fuel Cost</p>
                <p className="text-2xl font-bold">{formatCurrency(totalCost)}</p>
              </div>
              <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                <FuelIcon className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Liters</p>
                <p className="text-2xl font-bold">{totalLiters.toLocaleString()} L</p>
              </div>
              <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Droplets className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Avg. Cost/Liter</p>
                <p className="text-2xl font-bold">{formatCurrency(avgCostPerLiter)}</p>
              </div>
              <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fuel Consumption Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Bar yAxisId="left" dataKey="liters" fill="#3b82f6" name="Liters" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="cost" fill="#10b981" name="Cost (₦k)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Fuel logs table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fuel Purchase History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Liters</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Odometer</TableHead>
                <TableHead>Station</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fuelLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    No fuel records
                  </TableCell>
                </TableRow>
              ) : (
                fuelLogs.map((log) => {
                  const vehicle = vehicles.find((v) => v.id === log.vehicleId);
                  return (
                    <TableRow key={log.id}>
                      <TableCell>{format(new Date(log.date), 'MMM d, yyyy')}</TableCell>
                      <TableCell>
                        {vehicle ? (
                          <Link to={`/vehicles/${vehicle.id}`}>
                            <Badge variant="outline" className="cursor-pointer hover:bg-gray-100">
                              {vehicle.plateNumber}
                            </Badge>
                          </Link>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>{log.liters} L</TableCell>
                      <TableCell>{formatCurrency(log.cost)}</TableCell>
                      <TableCell>{log.odometer.toLocaleString()} km</TableCell>
                      <TableCell>{log.station || '-'}</TableCell>
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
