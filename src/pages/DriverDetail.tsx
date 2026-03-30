import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import type { Driver, Vehicle, Trip, Assignment, Incident } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, User, Car, Route, AlertTriangle, Phone, Mail, CreditCard, Calendar, MapPin, CircleDollarSign } from 'lucide-react';
import { format } from 'date-fns';
import {
  getAssignedVehicleForDriver,
  getDriverById,
  getVehicleById,
  listAssignmentsByDriver,
  listIncidentsByDriver,
  listTripsByDriver,
} from '@/lib/fleet-data';

export default function DriverDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [assignedVehicle, setAssignedVehicle] = useState<Vehicle | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [assignmentHistory, setAssignmentHistory] = useState<Assignment[]>([]);
  const [vehiclesMap, setVehiclesMap] = useState<Record<string, Vehicle>>({});

  useEffect(() => {
    if (id) {
      void loadDriverData();
    }
  }, [id]);

  const loadDriverData = async () => {
    const driverData = await getDriverById(id!);
    if (!driverData) {
      navigate('/drivers');
      return;
    }
    setDriver(driverData);

    // Get assigned vehicle
    const vehicle = await getAssignedVehicleForDriver(id!);
    setAssignedVehicle(vehicle || null);

    // Get trips
    const tripData = await listTripsByDriver(id!);
    setTrips(tripData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

    // Get incidents
    const incidentData = await listIncidentsByDriver(id!);
    setIncidents(incidentData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

    // Get assignment history
    const assignments = await listAssignmentsByDriver(id!);
    setAssignmentHistory(assignments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));

    const relatedVehicleIds = Array.from(
      new Set([
        ...tripData.map((trip) => trip.vehicleId),
        ...incidentData.map((incident) => incident.vehicleId),
        ...assignments.map((assignment) => assignment.vehicleId),
        ...(vehicle ? [vehicle.id] : []),
      ])
    );

    const relatedVehicles = await Promise.all(
      relatedVehicleIds.map(async (vehicleId) => {
        const relatedVehicle = await getVehicleById(vehicleId);
        return relatedVehicle ? [vehicleId, relatedVehicle] as const : null;
      })
    );

    setVehiclesMap(
      relatedVehicles.reduce<Record<string, Vehicle>>((acc, entry) => {
        if (entry) {
          acc[entry[0]] = entry[1];
        }
        return acc;
      }, {})
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate stats
  const totalTrips = trips.length;
  const totalDistance = trips.reduce((sum, t) => sum + t.distance, 0);
  const totalIncidents = incidents.length;
  const totalIncidentCost = incidents.reduce((sum, i) => sum + (i.finalRepairCost || i.repairCost), 0);

  if (!driver) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isLicenseExpiring =
    new Date(driver.licenseExpiry).getTime() - new Date().getTime() < 90 * 24 * 60 * 60 * 1000;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link to="/drivers">
        <Button variant="ghost" className="pl-0">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Drivers
        </Button>
      </Link>

      {/* Driver header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{driver.fullName}</h1>
            <p className="text-gray-500">{driver.licenseNumber}</p>
          </div>
        </div>
        <Badge variant={driver.status === 'Active' ? 'default' : 'secondary'} 
          className={driver.status === 'Active' ? 'bg-green-500 text-sm' : 'text-sm'}
        >
          {driver.status}
        </Badge>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">Total Trips</p>
                <p className="text-xl font-bold">{totalTrips}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Route className="w-5 h-5 text-blue-500" />
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
              <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
                <Car className="w-5 h-5 text-sky-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">Incidents</p>
                <p className="text-xl font-bold">{totalIncidents}</p>
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
                <p className="text-sm text-gray-500">Incident Cost</p>
                <p className="text-xl font-bold">{formatCurrency(totalIncidentCost)}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <CircleDollarSign className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trips">Trips</TabsTrigger>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Driver Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">Phone</p>
                      <p className="font-medium">{driver.phoneNumber}</p>
                    </div>
                  </div>
                  {driver.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Email</p>
                        <p className="font-medium">{driver.email}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">License Number</p>
                      <p className="font-medium">{driver.licenseNumber}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-500">License Expiry</p>
                      <p className={`font-medium ${isLicenseExpiring ? 'text-amber-600' : ''}`}>
                        {format(new Date(driver.licenseExpiry), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  {driver.dateOfBirth && (
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Date of Birth</p>
                        <p className="font-medium">
                          {format(new Date(driver.dateOfBirth), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                  )}
                  {driver.hireDate && (
                    <div className="flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Hire Date</p>
                        <p className="font-medium">
                          {format(new Date(driver.hireDate), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                {driver.address && (
                  <div className="flex items-start gap-3 pt-2 border-t">
                    <MapPin className="w-4 h-4 text-gray-400 mt-1" />
                    <div>
                      <p className="text-sm text-gray-500">Home Address</p>
                      <p className="font-medium">{driver.address}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Assigned Vehicle */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Car className="w-5 h-5" />
                  Current Assignment
                </CardTitle>
              </CardHeader>
              <CardContent>
                {assignedVehicle ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Car className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-lg">
                          {assignedVehicle.brand} {assignedVehicle.model}
                        </p>
                        <Link to={`/vehicles/${assignedVehicle.id}`}>
                          <Badge variant="outline" className="cursor-pointer hover:bg-gray-100">
                            {assignedVehicle.plateNumber}
                          </Badge>
                        </Link>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-3">
                      <div>
                        <p className="text-sm text-gray-500">Type</p>
                        <p className="font-medium">{assignedVehicle.vehicleType}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Year</p>
                        <p className="font-medium">{assignedVehicle.year}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Status</p>
                        <Badge
                          variant="outline"
                          className={
                            assignedVehicle.status === 'Active'
                              ? 'bg-green-100 text-green-700'
                              : assignedVehicle.status === 'Idle'
                              ? 'bg-gray-100 text-gray-700'
                              : 'bg-amber-100 text-amber-700'
                          }
                        >
                          {assignedVehicle.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Car className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No vehicle currently assigned</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
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
                      <TableHead>Vehicle</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Distance</TableHead>
                      <TableHead>Purpose</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trips.map((trip) => {
                      const vehicle = vehiclesMap[trip.vehicleId];
                      return (
                        <TableRow key={trip.id}>
                          <TableCell>{format(new Date(trip.date), 'MMM d, yyyy')}</TableCell>
                          <TableCell>{vehicle?.plateNumber || '-'}</TableCell>
                          <TableCell>{trip.startLocation}</TableCell>
                          <TableCell>{trip.destination}</TableCell>
                          <TableCell>{trip.distance} km</TableCell>
                          <TableCell>{trip.purpose || '-'}</TableCell>
                        </TableRow>
                      );
                    })}
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
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incidents.map((incident) => {
                      const vehicle = vehiclesMap[incident.vehicleId];
                      return (
                        <TableRow key={incident.id}>
                          <TableCell>{format(new Date(incident.date), 'MMM d, yyyy')}</TableCell>
                          <TableCell>{vehicle?.plateNumber || '-'}</TableCell>
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
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                incident.status === 'Resolved'
                                  ? 'bg-green-100 text-green-700'
                                  : incident.status === 'Under Review'
                                  ? 'bg-gray-100 text-gray-700'
                                  : 'bg-amber-100 text-amber-700'
                              }
                            >
                              {incident.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(incident.repairCost)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Car className="w-5 h-5" />
                Assignment History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {assignmentHistory.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No assignment history</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignmentHistory.map((assignment) => {
                      const vehicle = vehiclesMap[assignment.vehicleId];
                      const startDate = new Date(assignment.startDate);
                      const endDate = assignment.endDate ? new Date(assignment.endDate) : new Date();
                      const durationDays = Math.floor(
                        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
                      );

                      return (
                        <TableRow key={assignment.id}>
                          <TableCell>{format(startDate, 'MMM d, yyyy')}</TableCell>
                          <TableCell>
                            {assignment.endDate ? format(new Date(assignment.endDate), 'MMM d, yyyy') : 'Present'}
                          </TableCell>
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
                          <TableCell>
                            {assignment.endDate ? `${durationDays} days` : 'Ongoing'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
