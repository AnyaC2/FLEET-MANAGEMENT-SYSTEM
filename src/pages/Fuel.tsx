import { useState, useEffect, useEffectEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { FuelLog, Vehicle } from '@/types';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RegisterPagination } from '@/components/RegisterPagination';
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
import { Plus, Download, Search } from 'lucide-react';
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
  const [searchParams] = useSearchParams();
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'month' | '30d' | '90d'>(() =>
    searchParams.get('period') === 'month' ? 'month' : 'all'
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [chartData, setChartData] = useState<{ month: string; liters: number; cost: number }[]>([]);
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

  const loadInitialData = useEffectEvent(() => loadData());
  useEffect(() => {
    void loadInitialData();
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

  const filteredFuelLogs = fuelLogs.filter((log) => {
    const vehicle = vehicles.find((item) => item.id === log.vehicleId);
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || vehicle?.plateNumber.toLowerCase().includes(query) || log.station?.toLowerCase().includes(query);
    const logDate = new Date(log.date);
    const now = new Date();
    const daysAgo = (now.getTime() - logDate.getTime()) / 86_400_000;
    const matchesPeriod = periodFilter === 'all'
      || (periodFilter === 'month' && logDate.getMonth() === now.getMonth() && logDate.getFullYear() === now.getFullYear())
      || (periodFilter === '30d' && daysAgo >= 0 && daysAgo <= 30)
      || (periodFilter === '90d' && daysAgo >= 0 && daysAgo <= 90);
    return matchesSearch && matchesPeriod;
  });
  const fuelPageCount = Math.max(1, Math.ceil(filteredFuelLogs.length / pageSize));
  const visibleFuelPage = Math.min(currentPage, fuelPageCount);
  const paginatedFuelLogs = filteredFuelLogs.slice((visibleFuelPage - 1) * pageSize, visibleFuelPage * pageSize);

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
    <div className="space-y-5">
      {/* Page header */}
      <div className="lfz-enter flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.035em] text-gray-900 sm:text-[2.25rem]">Fuel management</h1>
          <p className="mt-1.5 text-sm text-gray-500">Fuel purchases, quantities and cost per vehicle.</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
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
      <dl className="lfz-summary-strip" aria-label="Fuel totals, all recorded purchases">
        <div><dt>Total spend <span className="text-xs">/ all time</span></dt><dd>{formatCurrency(totalCost)}</dd></div>
        <div><dt>Fuel purchased</dt><dd>{totalLiters.toLocaleString()} <span className="text-base font-normal text-gray-500">litres</span></dd></div>
        <div><dt>Average price per litre</dt><dd>{formatCurrency(avgCostPerLiter)}</dd></div>
      </dl>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fuel purchases by month</CardTitle>
          <div className="flex flex-wrap gap-4 text-xs text-gray-600">
            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-sm bg-[#15247f]" />Litres · left axis</span>
            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-sm bg-[#00864a]" />Cost (₦ thousands) · right axis</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 720, height: 256 }}>
              <BarChart data={chartData}>
                <CartesianGrid vertical={false} stroke="#e7e9ee" strokeDasharray="3 4" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} width={44} tick={{ fontSize: 11, fill: '#6b7280' }} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} width={44} tick={{ fontSize: 11, fill: '#6b7280' }} />
                <Tooltip />
                <Bar yAxisId="left" dataKey="liters" fill="#15247f" name="Liters" radius={[5, 5, 0, 0]} />
                <Bar yAxisId="right" dataKey="cost" fill="#00864a" name="Cost (₦k)" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Fuel logs table */}
      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="border-b border-gray-100 py-5">
          <CardTitle className="text-lg">Fuel Purchase History</CardTitle>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input aria-label="Search fuel records" className="pl-10" placeholder="Search plate or fuel station..." value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setCurrentPage(1); }} />
            </div>
            <Select value={periodFilter} onValueChange={(value) => { setPeriodFilter(value as typeof periodFilter); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-40" aria-label="Filter fuel records by period"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All dates</SelectItem>
                <SelectItem value="month">This month</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
              {filteredFuelLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    {fuelLogs.length ? 'No fuel records match these filters' : 'No fuel records'}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedFuelLogs.map((log) => {
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
        <RegisterPagination currentPage={visibleFuelPage} itemLabel="records" onPageChange={setCurrentPage} onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }} pageSize={pageSize} totalItems={filteredFuelLogs.length} />
      </Card>
    </div>
  );
}
