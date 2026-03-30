import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Trip, Vehicle, Driver } from '@/types';
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
import { Plus, Route, TrendingUp } from 'lucide-react';
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

export default function Trips() {
  const { canManageRecords } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);
  const [startLocationSuggestion, setStartLocationSuggestion] = useState<LocationSuggestion | null>(null);
  const [destinationLocationSuggestion, setDestinationLocationSuggestion] = useState<LocationSuggestion | null>(null);

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
    } catch (error) {
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

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trips</h1>
          <p className="text-gray-500">Log and track vehicle trips</p>
        </div>
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

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Trips</p>
                <p className="text-2xl font-bold">{totalTrips}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Route className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Distance</p>
                <p className="text-2xl font-bold">{totalDistance.toLocaleString()} km</p>
              </div>
              <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Avg. Distance/Trip</p>
                <p className="text-2xl font-bold">{avgDistance.toFixed(1)} km</p>
              </div>
              <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center">
                <Route className="w-6 h-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Trip Activity (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Bar yAxisId="left" dataKey="trips" fill="#3b82f6" name="Trips" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="distance" fill="#10b981" name="Distance (km)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Trips table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Trip History</CardTitle>
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
              {trips.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    No trip records
                  </TableCell>
                </TableRow>
              ) : (
                trips.map((trip) => {
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
      </Card>
    </div>
  );
}
