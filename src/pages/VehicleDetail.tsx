import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type { Vehicle, Driver, FuelLog, Maintenance, Incident, OdometerLog, Trip } from '@/types';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  ArrowLeft,
  Car,
  User,
  Fuel,
  Wrench,
  AlertTriangle,
  Route,
  Edit,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  assignDriverToVehicle,
  getDriverById,
  getVehicleById,
  listOdometerLogsByVehicle,
  listFuelLogsByVehicle,
  listIncidentsByVehicle,
  listMaintenanceByVehicle,
  listActiveDrivers,
  recordVehicleOdometer,
  listTripsByVehicle,
  updateVehicleServiceDueOdometer,
} from '@/lib/fleet-data';

export default function VehicleDetail() {
  const { canManageRecords } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [odometerLogs, setOdometerLogs] = useState<OdometerLog[]>([]);
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isChangeDriverModalOpen, setIsChangeDriverModalOpen] = useState(false);
  const [isOdometerModalOpen, setIsOdometerModalOpen] = useState(false);
  const [isServiceDueModalOpen, setIsServiceDueModalOpen] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [odometerForm, setOdometerForm] = useState({ reading: '', notes: '' });
  const [serviceDueForm, setServiceDueForm] = useState('');

  useEffect(() => {
    if (id) {
      void loadVehicleData();
    }
  }, [id]);

  const loadVehicleData = async () => {
    const vehicleData = await getVehicleById(id!);
    if (!vehicleData) {
      navigate('/vehicles');
      return;
    }
    setVehicle(vehicleData);

    // Get assigned driver
    if (vehicleData.currentDriverId) {
      const driverData = await getDriverById(vehicleData.currentDriverId);
      setDriver(driverData || null);
    } else {
      setDriver(null);
    }

    // Get fuel logs
    const fuelData = await listFuelLogsByVehicle(id!);
    setFuelLogs(fuelData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

    const odometerHistory = await listOdometerLogsByVehicle(id!);
    setOdometerLogs(odometerHistory);

    // Get maintenance
    const maintData = await listMaintenanceByVehicle(id!);
    setMaintenance(maintData.sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()));

    // Get incidents
    const incidentData = await listIncidentsByVehicle(id!);
    setIncidents(incidentData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

    // Get trips
    const tripData = await listTripsByVehicle(id!);
    setTrips(tripData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

    // Get available drivers
    const allDrivers = await listActiveDrivers();
    setDrivers(allDrivers);
  };

  const handleChangeDriver = async () => {
    if (!selectedDriverId) {
      toast.error('Please select a driver');
      return;
    }

    try {
      await assignDriverToVehicle(id!, selectedDriverId);
      toast.success('Driver assigned successfully');
      setIsChangeDriverModalOpen(false);
      await loadVehicleData();
    } catch (error) {
      toast.error('Failed to assign driver');
    }
  };

  const handleUpdateOdometer = async () => {
    const reading = Number(odometerForm.reading);
    if (!Number.isFinite(reading) || reading < 0) {
      toast.error('Please enter a valid odometer reading');
      return;
    }

    try {
      await recordVehicleOdometer({
        vehicleId: id!,
        reading,
        source: 'manual',
        notes: odometerForm.notes || undefined,
      });
      toast.success('Odometer updated successfully');
      setIsOdometerModalOpen(false);
      setOdometerForm({ reading: '', notes: '' });
      await loadVehicleData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update odometer');
    }
  };

  const handleUpdateServiceDueOdometer = async () => {
    const nextServiceDueOdometer = serviceDueForm ? Number(serviceDueForm) : undefined;

    if (nextServiceDueOdometer !== undefined && (!Number.isFinite(nextServiceDueOdometer) || nextServiceDueOdometer < 0)) {
      toast.error('Please enter a valid service due mileage');
      return;
    }

    if (
      nextServiceDueOdometer !== undefined &&
      vehicle?.currentOdometer !== undefined &&
      nextServiceDueOdometer < vehicle.currentOdometer
    ) {
      toast.error('Next service due mileage cannot be lower than the current odometer');
      return;
    }

    try {
      await updateVehicleServiceDueOdometer(id!, nextServiceDueOdometer);
      toast.success('Service due mileage updated successfully');
      setIsServiceDueModalOpen(false);
      await loadVehicleData();
    } catch (error) {
      toast.error('Failed to update service due mileage');
    }
  };

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      Active: 'bg-green-100 text-green-700',
      Idle: 'bg-gray-100 text-gray-700',
      'Under Maintenance': 'bg-amber-100 text-amber-700',
      Decommissioned: 'bg-red-100 text-red-700',
      Completed: 'bg-green-100 text-green-700',
      Scheduled: 'bg-gray-100 text-gray-700',
      'In Progress': 'bg-amber-100 text-amber-700',
      Overdue: 'bg-red-100 text-red-700',
      Resolved: 'bg-green-100 text-green-700',
      'Under Review': 'bg-gray-100 text-gray-700',
      'In Repair': 'bg-amber-100 text-amber-700',
    };
    return <Badge variant="outline" className={classes[status] || 'bg-gray-100 text-gray-700'}>{status}</Badge>;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate stats
  const totalFuelCost = fuelLogs.reduce((sum, f) => sum + f.cost, 0);
  const totalMaintenanceCost = maintenance.reduce((sum, m) => sum + m.cost, 0);
  const totalIncidentCost = incidents.reduce((sum, i) => sum + (i.finalRepairCost || i.repairCost), 0);
  const totalDistance = trips.reduce((sum, t) => sum + t.distance, 0);

  if (!vehicle) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link to="/vehicles">
        <Button variant="ghost" className="pl-0">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Vehicles
        </Button>
      </Link>

      {/* Vehicle header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {vehicle.brand} {vehicle.model}
          </h1>
          <p className="text-gray-500">{vehicle.plateNumber}</p>
        </div>
        <div className="flex items-center gap-2">
          {canManageRecords && (
            <>
              <Button variant="outline" onClick={() => {
                setOdometerForm({ reading: vehicle.currentOdometer?.toString() || '', notes: '' });
                setIsOdometerModalOpen(true);
              }}>
                <Edit className="w-4 h-4 mr-2" />
                Update Odometer
              </Button>
              <Button variant="outline" onClick={() => {
                setServiceDueForm(vehicle.nextServiceDueOdometer?.toString() || '');
                setIsServiceDueModalOpen(true);
              }}>
                <Wrench className="w-4 h-4 mr-2" />
                Set Service Due
              </Button>
            </>
          )}
          {getStatusBadge(vehicle.status)}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">Total Fuel Cost</p>
                <p className="text-xl font-bold">{formatCurrency(totalFuelCost)}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Fuel className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">Maintenance Cost</p>
                <p className="text-xl font-bold">{formatCurrency(totalMaintenanceCost)}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Wrench className="w-5 h-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">Incident Cost</p>
                <p className="text-xl font-bold">{formatCurrency(totalIncidentCost)}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">Total Distance</p>
                <p className="text-xl font-bold">{totalDistance.toLocaleString()} km</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Route className="w-5 h-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="fuel">Fuel</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="trips">Trips</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Vehicle Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Car className="w-5 h-5" />
                  Vehicle Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Plate Number</p>
                    <p className="font-medium">{vehicle.plateNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Vehicle Type</p>
                    <p className="font-medium">{vehicle.vehicleType}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Brand & Model</p>
                    <p className="font-medium">{vehicle.brand} {vehicle.model}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Year</p>
                    <p className="font-medium">{vehicle.year}</p>
                  </div>
                  {vehicle.vin && (
                    <div>
                      <p className="text-sm text-gray-500">VIN</p>
                      <p className="font-medium">{vehicle.vin}</p>
                    </div>
                  )}
                  {vehicle.engineNumber && (
                    <div>
                      <p className="text-sm text-gray-500">Engine Number</p>
                      <p className="font-medium">{vehicle.engineNumber}</p>
                    </div>
                  )}
                  {vehicle.purchaseDate && (
                    <div>
                      <p className="text-sm text-gray-500">Purchase Date</p>
                      <p className="font-medium">{format(new Date(vehicle.purchaseDate), 'MMM d, yyyy')}</p>
                    </div>
                  )}
                  {vehicle.purchaseCost && (
                    <div>
                      <p className="text-sm text-gray-500">Purchase Cost</p>
                      <p className="font-medium">{formatCurrency(vehicle.purchaseCost)}</p>
                    </div>
                  )}
                  {vehicle.vendor && (
                    <div>
                      <p className="text-sm text-gray-500">Vendor</p>
                      <p className="font-medium">{vehicle.vendor}</p>
                    </div>
                  )}
                  {vehicle.warrantyExpiry && (
                    <div>
                      <p className="text-sm text-gray-500">Warranty Expiry</p>
                      <p className="font-medium">{format(new Date(vehicle.warrantyExpiry), 'MMM d, yyyy')}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-500">Current Odometer</p>
                    <p className="font-medium">
                      {vehicle.currentOdometer !== undefined ? `${vehicle.currentOdometer.toLocaleString()} km` : 'No reading yet'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Next Service Due</p>
                    <p className="font-medium">
                      {vehicle.nextServiceDueOdometer !== undefined
                        ? `${vehicle.nextServiceDueOdometer.toLocaleString()} km`
                        : 'Not set'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Assigned Driver */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Assigned Driver
                </CardTitle>
                {canManageRecords && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsChangeDriverModalOpen(true)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Change Driver
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {driver ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-lg">{driver.fullName}</p>
                        <Badge variant="outline" className="bg-green-100 text-green-700">Active</Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-3">
                      <div>
                        <p className="text-sm text-gray-500">Phone</p>
                        <p className="font-medium">{driver.phoneNumber}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">License</p>
                        <p className="font-medium">{driver.licenseNumber}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">License Expiry</p>
                        <p className="font-medium">{format(new Date(driver.licenseExpiry), 'MMM d, yyyy')}</p>
                      </div>
                      {driver.email && (
                        <div>
                          <p className="text-sm text-gray-500">Email</p>
                          <p className="font-medium">{driver.email}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No driver assigned</p>
                    {canManageRecords && (
                      <Button
                        variant="outline"
                        className="mt-3"
                        onClick={() => setIsChangeDriverModalOpen(true)}
                      >
                        Assign Driver
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Odometer History</CardTitle>
            </CardHeader>
            <CardContent>
              {odometerLogs.length === 0 ? (
                <p className="text-gray-500 text-center py-6">No odometer history yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Reading</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {odometerLogs.slice(0, 5).map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{format(new Date(log.recordedAt), 'MMM d, yyyy')}</TableCell>
                        <TableCell>{log.reading.toLocaleString()} km</TableCell>
                        <TableCell className="capitalize">{log.source}</TableCell>
                        <TableCell>{log.notes || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fuel Tab */}
        <TabsContent value="fuel">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Fuel className="w-5 h-5" />
                Fuel History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {fuelLogs.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No fuel records</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Liters</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Odometer</TableHead>
                      <TableHead>Station</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fuelLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{format(new Date(log.date), 'MMM d, yyyy')}</TableCell>
                        <TableCell>{log.liters} L</TableCell>
                        <TableCell>{formatCurrency(log.cost)}</TableCell>
                        <TableCell>{log.odometer.toLocaleString()} km</TableCell>
                        <TableCell>{log.station || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Maintenance Tab */}
        <TabsContent value="maintenance">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Wrench className="w-5 h-5" />
                Maintenance History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {maintenance.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No maintenance records</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Service Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Provider</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {maintenance.map((maint) => (
                      <TableRow key={maint.id}>
                        <TableCell>{format(new Date(maint.scheduledDate), 'MMM d, yyyy')}</TableCell>
                        <TableCell>{maint.serviceType}</TableCell>
                        <TableCell>{getStatusBadge(maint.status)}</TableCell>
                        <TableCell>{formatCurrency(maint.cost)}</TableCell>
                        <TableCell>{maint.serviceProvider || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Incidents Tab */}
        <TabsContent value="incidents">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Incident History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {incidents.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No incident records</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Repair Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incidents.map((incident) => (
                      <TableRow key={incident.id}>
                        <TableCell>{format(new Date(incident.date), 'MMM d, yyyy')}</TableCell>
                        <TableCell>{incident.title}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              incident.severity === 'Minor'
                                ? 'bg-gray-100 text-gray-700'
                                : incident.severity === 'Moderate'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-red-100 text-red-700'
                            }
                          >
                            {incident.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(incident.status)}</TableCell>
                        <TableCell>{formatCurrency(incident.repairCost)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trips Tab */}
        <TabsContent value="trips">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Route className="w-5 h-5" />
                Trip History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {trips.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No trip records</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Distance</TableHead>
                      <TableHead>Purpose</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trips.map((trip) => (
                      <TableRow key={trip.id}>
                        <TableCell>{format(new Date(trip.date), 'MMM d, yyyy')}</TableCell>
                        <TableCell>{trip.startLocation}</TableCell>
                        <TableCell>{trip.destination}</TableCell>
                        <TableCell>{trip.distance} km</TableCell>
                        <TableCell>{trip.purpose || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Change Driver Modal */}
      <Dialog open={isChangeDriverModalOpen} onOpenChange={setIsChangeDriverModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Driver</DialogTitle>
            <DialogDescription>
              Select a new driver to assign to this vehicle.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a driver" />
              </SelectTrigger>
              <SelectContent>
                {drivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.fullName} - {d.licenseNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsChangeDriverModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleChangeDriver}>Assign Driver</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isOdometerModalOpen} onOpenChange={setIsOdometerModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Odometer</DialogTitle>
            <DialogDescription>
              Enter the latest odometer reading for this vehicle. The value cannot go backwards.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="odometerReading">Odometer Reading (km)</Label>
              <Input
                id="odometerReading"
                type="number"
                min="0"
                value={odometerForm.reading}
                onChange={(e) => setOdometerForm((prev) => ({ ...prev, reading: e.target.value }))}
                placeholder="e.g., 16050"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="odometerNotes">Notes</Label>
              <Input
                id="odometerNotes"
                value={odometerForm.notes}
                onChange={(e) => setOdometerForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Optional note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOdometerModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleUpdateOdometer()}>Save Reading</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isServiceDueModalOpen} onOpenChange={setIsServiceDueModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set Service Due Mileage</DialogTitle>
            <DialogDescription>
              Set the odometer reading at which this vehicle should be serviced next.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="serviceDueMileage">Next Service Due (km)</Label>
              <Input
                id="serviceDueMileage"
                type="number"
                min="0"
                value={serviceDueForm}
                onChange={(e) => setServiceDueForm(e.target.value)}
                placeholder="e.g., 20000"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsServiceDueModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleUpdateServiceDueOdometer()}>Save Mileage</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
