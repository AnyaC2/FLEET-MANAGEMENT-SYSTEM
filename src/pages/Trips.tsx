import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Trip, Vehicle, Driver } from '@/types';
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
import { createTrip, listOperationalVehiclesAndActiveDrivers, listTrips } from '@/lib/fleet-data';
import { LocationAutocompleteInput } from '@/components/LocationAutocompleteInput';
import {
  type LocationSuggestion,
  calculateRouteDistanceKm,
} from '@/lib/location-search';
import { exportWorkbook } from '@/lib/excel-export';
import { dateFallsInRange, resolveDateRange, type PeriodPreset } from '@/lib/report-filters';

export default function Trips() {
  const { canManageRecords } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'all' | '7d' | '30d' | '90d'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);
  const [chartData, setChartData] = useState<{ day: string; trips: number; distance: number }[]>([]);
  const [startLocationSuggestion, setStartLocationSuggestion] = useState<LocationSuggestion | null>(null);
  const [destinationLocationSuggestion, setDestinationLocationSuggestion] = useState<LocationSuggestion | null>(null);
  const [reportPreset, setReportPreset] = useState<PeriodPreset>('30d');
  const [reportVehicleId, setReportVehicleId] = useState('all');
  const [reportDriverId, setReportDriverId] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    vehicleId: '',
    driverId: '',
    date: new Date().toISOString().split('T')[0],
    startLocation: '',
    destination: '',
    distance: '',
    purpose: '',
  });

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!startLocationSuggestion || !destinationLocationSuggestion) {
      return;
    }

    const controller = new AbortController();

    void (async () => {
      try {
        setIsCalculatingDistance(true);
        const distance = await calculateRouteDistanceKm(
          startLocationSuggestion,
          destinationLocationSuggestion,
          controller.signal
        );
        setFormData((prev) => ({ ...prev, distance: distance.toString() }));
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          setFormData((prev) => ({ ...prev, distance: '' }));
          toast.error('Could not calculate route distance automatically');
        }
      } finally {
        setIsCalculatingDistance(false);
      }
    })();

    return () => {
      controller.abort();
    };
  }, [startLocationSuggestion, destinationLocationSuggestion]);

  const loadData = async () => {
    const tripData = await listTrips();
    const sortedTrips = tripData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setTrips(sortedTrips);

    const fleetData = await listOperationalVehiclesAndActiveDrivers();
    setVehicles(fleetData.vehicles);
    setDrivers(fleetData.drivers);

    // Prepare chart data (last 7 days)
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const data = days.map((day, index) => {
      const dayTrips = tripData.filter((trip) => {
        const tripDate = new Date(trip.date);
        const today = new Date();
        const diffDays = Math.floor((today.getTime() - tripDate.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays === (6 - index);
      });
      return {
        day,
        trips: dayTrips.length,
        distance: dayTrips.reduce((sum, t) => sum + t.distance, 0),
      };
    });
    setChartData(data);
  };

  const filteredTrips = trips.filter((trip) => {
    const vehicle = vehicles.find((item) => item.id === trip.vehicleId);
    const driver = drivers.find((item) => item.id === trip.driverId);
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || [vehicle?.plateNumber, driver?.fullName, trip.startLocation, trip.destination, trip.purpose]
      .some((value) => value?.toLowerCase().includes(query));
    const tripDate = new Date(trip.date);
    const daysAgo = (Date.now() - tripDate.getTime()) / 86_400_000;
    const matchesPeriod = periodFilter === 'all' || (daysAgo >= 0 && daysAgo <= Number(periodFilter.replace('d', '')));
    return matchesSearch && matchesPeriod;
  });
  const tripPageCount = Math.max(1, Math.ceil(filteredTrips.length / pageSize));
  const visibleTripPage = Math.min(currentPage, tripPageCount);
  const paginatedTrips = filteredTrips.slice((visibleTripPage - 1) * pageSize, visibleTripPage * pageSize);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validation
      if (!formData.vehicleId || !formData.driverId || !formData.date || !formData.startLocation || !formData.destination || !formData.distance) {
        toast.error('Please fill in all required fields');
        setIsSubmitting(false);
        return;
      }

      const distance = parseFloat(formData.distance);
      if (isNaN(distance) || distance <= 0) {
        toast.error('Please enter a valid distance');
        setIsSubmitting(false);
        return;
      }

      const newTrip: Trip = {
        id: `trip-${Date.now()}`,
        vehicleId: formData.vehicleId,
        driverId: formData.driverId,
        date: formData.date,
        startLocation: formData.startLocation,
        destination: formData.destination,
        distance,
        purpose: formData.purpose || undefined,
        createdAt: new Date().toISOString(),
      };

      await createTrip(newTrip);
      toast.success('Trip logged successfully');
      setIsAddModalOpen(false);
      resetForm();
      await loadData();
    } catch {
      toast.error('Failed to log trip');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      vehicleId: '',
      driverId: '',
      date: new Date().toISOString().split('T')[0],
      startLocation: '',
      destination: '',
      distance: '',
      purpose: '',
    });
    setStartLocationSuggestion(null);
    setDestinationLocationSuggestion(null);
  };

  // Calculate stats
  const totalTrips = trips.length;
  const totalDistance = trips.reduce((sum, trip) => sum + trip.distance, 0);
  const avgDistance = totalTrips > 0 ? totalDistance / totalTrips : 0;

  const handleExportTripsReport = () => {
    const range = resolveDateRange({
      preset: reportPreset,
      customStartDate,
      customEndDate,
    });
    const rows = trips
      .filter((trip) => dateFallsInRange(trip.date, range))
      .filter((trip) => reportVehicleId === 'all' || trip.vehicleId === reportVehicleId)
      .filter((trip) => reportDriverId === 'all' || trip.driverId === reportDriverId)
      .map((trip) => {
        const vehicle = vehicles.find((item) => item.id === trip.vehicleId);
        const driver = drivers.find((item) => item.id === trip.driverId);
        return {
          Date: format(new Date(trip.date), 'MMM d, yyyy'),
          'Plate Number': vehicle?.plateNumber ?? '-',
          Driver: driver?.fullName ?? '-',
          'Start Location': trip.startLocation,
          Destination: trip.destination,
          'Distance (km)': trip.distance,
          Purpose: trip.purpose ?? '-',
        };
      });

    exportWorkbook({
      filename: `trips-report-${new Date().toISOString().split('T')[0]}.xlsx`,
      sheets: [
        {
          name: 'Trips',
          rows,
        },
      ],
    });
    setIsReportModalOpen(false);
    toast.success('Trips report downloaded');
  };

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="lfz-enter flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.035em] text-gray-900 sm:text-[2.25rem]">Trips</h1>
          <p className="mt-1.5 text-sm text-gray-500">Monitor journeys, distance covered, and assigned personnel.</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Dialog open={isReportModalOpen} onOpenChange={setIsReportModalOpen}>
            <Button variant="outline" onClick={() => setIsReportModalOpen(true)}>
              <Download className="w-4 h-4 mr-2" />
              Generate Report
            </Button>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Trips Report</DialogTitle>
                <DialogDescription>
                  Filter trips by date range, vehicle, and driver before exporting to Excel.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
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
                      <Label htmlFor="tripsReportStartDate">Start Date</Label>
                      <Input id="tripsReportStartDate" type="date" value={customStartDate} onChange={(event) => setCustomStartDate(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tripsReportEndDate">End Date</Label>
                      <Input id="tripsReportEndDate" type="date" value={customEndDate} onChange={(event) => setCustomEndDate(event.target.value)} />
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
                <div className="space-y-2">
                  <Label>Driver</Label>
                  <Select value={reportDriverId} onValueChange={setReportDriverId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All drivers</SelectItem>
                      {drivers.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id}>
                          {driver.fullName}
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
                <Button type="button" onClick={handleExportTripsReport}>
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
                Log Trip
              </Button>
            </DialogTrigger>
          )}
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Log New Trip</DialogTitle>
              <DialogDescription>
                Record a new trip for a vehicle.
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
                  <Label htmlFor="driverId">Driver *</Label>
                  <Select
                    value={formData.driverId}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, driverId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select driver" />
                    </SelectTrigger>
                    <SelectContent>
                      {drivers.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id}>
                          {driver.fullName}
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startLocation">From *</Label>
                    <LocationAutocompleteInput
                      id="startLocation"
                      value={formData.startLocation}
                      onChangeText={(value) =>
                        setFormData((prev) => ({ ...prev, startLocation: value, distance: '' }))
                      }
                      onLocationSelect={setStartLocationSuggestion}
                      placeholder="Start typing a location"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="destination">To *</Label>
                    <LocationAutocompleteInput
                      id="destination"
                      value={formData.destination}
                      onChangeText={(value) =>
                        setFormData((prev) => ({ ...prev, destination: value, distance: '' }))
                      }
                      onLocationSelect={setDestinationLocationSuggestion}
                      placeholder="Type destination"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="distance">Distance (km) *</Label>
                  <Input
                    id="distance"
                    name="distance"
                    type="number"
                    value={formData.distance}
                    onChange={handleInputChange}
                    placeholder="Auto-calculated after selecting suggested locations"
                    readOnly={Boolean(startLocationSuggestion && destinationLocationSuggestion)}
                  />
                  <p className="text-xs text-gray-500">
                    {isCalculatingDistance
                      ? 'Calculating route distance...'
                      : 'Choose suggested locations to auto-calculate distance, or type distance manually if needed.'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purpose">Purpose</Label>
                  <Input
                    id="purpose"
                    name="purpose"
                    value={formData.purpose}
                    onChange={handleInputChange}
                    placeholder="e.g., Airport pickup"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Logging...' : 'Log Trip'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Stats cards */}
      <dl className="lfz-summary-strip" aria-label="Trip totals, all recorded trips">
        <div><dt>Trips recorded <span className="text-xs">/ all time</span></dt><dd>{totalTrips}</dd></div>
        <div><dt>Total distance</dt><dd>{totalDistance.toLocaleString()} <span className="text-base font-normal text-gray-500">km</span></dd></div>
        <div><dt>Average distance per trip</dt><dd>{avgDistance.toFixed(1)} <span className="text-base font-normal text-gray-500">km</span></dd></div>
      </dl>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Trip activity · last 7 days</CardTitle>
          <div className="flex flex-wrap gap-4 text-xs text-gray-600">
            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-sm bg-[#15247f]" />Trips · left axis</span>
            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-sm bg-[#00864a]" />Distance (km) · right axis</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 720, height: 256 }}>
              <BarChart data={chartData}>
                <CartesianGrid vertical={false} stroke="#e7e9ee" strokeDasharray="3 4" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <YAxis yAxisId="left" allowDecimals={false} axisLine={false} tickLine={false} width={44} tick={{ fontSize: 11, fill: '#6b7280' }} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} width={44} tick={{ fontSize: 11, fill: '#6b7280' }} />
                <Tooltip />
                <Bar yAxisId="left" dataKey="trips" fill="#15247f" name="Trips" radius={[5, 5, 0, 0]} />
                <Bar yAxisId="right" dataKey="distance" fill="#00864a" name="Distance (km)" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Trips table */}
      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="border-b border-gray-100 py-5">
          <CardTitle className="text-lg">Trip History</CardTitle>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input aria-label="Search trip records" className="pl-10" placeholder="Search plate, driver, route, or purpose..." value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setCurrentPage(1); }} />
            </div>
            <Select value={periodFilter} onValueChange={(value) => { setPeriodFilter(value as typeof periodFilter); setCurrentPage(1); }}>
              <SelectTrigger className="w-full sm:w-40" aria-label="Filter trips by period"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All dates</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
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
                <TableHead>Driver</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Distance</TableHead>
                <TableHead>Purpose</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTrips.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    {trips.length ? 'No trip records match these filters' : 'No trip records'}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedTrips.map((trip) => {
                  const vehicle = vehicles.find((v) => v.id === trip.vehicleId);
                  const driver = drivers.find((d) => d.id === trip.driverId);
                  return (
                    <TableRow key={trip.id}>
                      <TableCell>{format(new Date(trip.date), 'MMM d, yyyy')}</TableCell>
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
                      <TableCell>{driver?.fullName || '-'}</TableCell>
                      <TableCell>{trip.startLocation}</TableCell>
                      <TableCell>{trip.destination}</TableCell>
                      <TableCell>{trip.distance} km</TableCell>
                      <TableCell>{trip.purpose || '-'}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
        <RegisterPagination currentPage={visibleTripPage} itemLabel="trips" onPageChange={setCurrentPage} onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }} pageSize={pageSize} totalItems={filteredTrips.length} />
      </Card>
    </div>
  );
}
