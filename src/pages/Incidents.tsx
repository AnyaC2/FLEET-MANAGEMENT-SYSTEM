import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Incident, Vehicle, Driver } from '@/types';
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
import { Plus, Eye, CheckCircle2, Clock, Wrench, AlertTriangle, CircleDollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  createIncident,
  listIncidents,
  listOperationalVehiclesAndActiveDrivers,
  updateIncident,
} from '@/lib/fleet-data';

const severityOptions = ['Minor', 'Moderate', 'Major'];
const statusOptions = ['Under Review', 'In Repair', 'Resolved'];
const NO_DRIVER_VALUE = 'none';

export default function Incidents() {
  const { canManageRecords } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    vehicleId: '',
    driverId: '',
    title: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    severity: 'Minor' as 'Minor' | 'Moderate' | 'Major',
    status: 'Under Review' as 'Under Review' | 'In Repair' | 'Resolved',
    location: '',
    repairCost: '',
  });

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    const incidentData = await listIncidents();
    const sortedIncidents = incidentData.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    setIncidents(sortedIncidents);

    const fleetData = await listOperationalVehiclesAndActiveDrivers();
    setVehicles(fleetData.vehicles);
    setDrivers(fleetData.drivers);
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
      if (!formData.vehicleId || !formData.title || !formData.date || !formData.description) {
        toast.error('Please fill in all required fields');
        setIsSubmitting(false);
        return;
      }

      const repairCost = parseFloat(formData.repairCost) || 0;

      const newIncident: Incident = {
        id: `inc-${Date.now()}`,
        vehicleId: formData.vehicleId,
        driverId: formData.driverId || undefined,
        title: formData.title,
        date: formData.date,
        description: formData.description,
        severity: formData.severity,
        status: formData.status,
        location: formData.location || undefined,
        repairCost,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await createIncident(newIncident);
      toast.success('Incident reported successfully');
      setIsAddModalOpen(false);
      resetForm();
      await loadData();
    } catch (error) {
      toast.error('Failed to report incident');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      vehicleId: '',
      driverId: '',
      title: '',
      date: new Date().toISOString().split('T')[0],
      description: '',
      severity: 'Minor',
      status: 'Under Review',
      location: '',
      repairCost: '',
    });
  };

  const handleStatusUpdate = async (id: string, newStatus: Incident['status']) => {
    try {
      const updatedIncident = await updateIncident(id, { status: newStatus });
      toast.success(`Incident status updated to ${newStatus}`);
      await loadData();
      if (updatedIncident) {
        setSelectedIncident(updatedIncident);
      }
    } catch (error) {
      toast.error('Failed to update incident status');
    }
  };

  const handleFinalCostUpdate = async (id: string, finalCost: number) => {
    if (Number.isNaN(finalCost)) {
      return;
    }

    try {
      const updatedIncident = await updateIncident(id, { finalRepairCost: finalCost });
      toast.success('Final repair cost updated');
      await loadData();
      if (updatedIncident) {
        setSelectedIncident(updatedIncident);
      }
    } catch (error) {
      toast.error('Failed to update final repair cost');
    }
  };

  const openDetailModal = (incident: Incident) => {
    setSelectedIncident(incident);
    setIsDetailModalOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getSeverityBadge = (severity: Incident['severity']) => {
    const classes = {
      Minor: 'bg-gray-100 text-gray-700',
      Moderate: 'bg-amber-100 text-amber-700',
      Major: 'bg-red-100 text-red-700',
    };
    return (
      <Badge variant="outline" className={classes[severity]}>
        {severity}
      </Badge>
    );
  };

  const getStatusBadge = (status: Incident['status']) => {
    const icons = {
      'Under Review': Clock,
      'In Repair': Wrench,
      Resolved: CheckCircle2,
    };
    const Icon = icons[status];
    const classes = {
      'Under Review': 'bg-gray-100 text-gray-700',
      'In Repair': 'bg-amber-100 text-amber-700',
      Resolved: 'bg-green-100 text-green-700',
    };
    return (
      <Badge variant="outline" className={`flex items-center gap-1 w-fit ${classes[status]}`}>
        <Icon className="w-3 h-3" />
        {status}
      </Badge>
    );
  };

  // Calculate stats
  const totalIncidents = incidents.length;
  const resolvedCount = incidents.filter((i) => i.status === 'Resolved').length;
  const pendingCount = incidents.filter((i) => i.status !== 'Resolved').length;
  const totalCost = incidents.reduce((sum, i) => sum + (i.finalRepairCost || i.repairCost), 0);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Incidents</h1>
          <p className="text-gray-500">Track and manage vehicle incidents</p>
        </div>
        {canManageRecords && (
          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Report Incident
          </Button>
        )}
      </div>

      {/* Add Incident Modal */}
      <Dialog
        open={isAddModalOpen}
        onOpenChange={(open) => {
          setIsAddModalOpen(open);
          if (!open) {
            resetForm();
          }
        }}
      >
        <DialogContent className="w-[95%] max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Report New Incident</DialogTitle>
            <DialogDescription>
              Report a new incident or accident involving a vehicle.
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
                <Label htmlFor="driverId">Driver</Label>
                <Select
                  value={formData.driverId || NO_DRIVER_VALUE}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      driverId: value === NO_DRIVER_VALUE ? '' : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select driver (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_DRIVER_VALUE}>None</SelectItem>
                    {drivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Incident Title *</Label>
                <Input
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="e.g., Front Bumper Scratch"
                />
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
                  <Label htmlFor="severity">Severity</Label>
                  <Select
                    value={formData.severity}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, severity: value as Incident['severity'] }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {severityOptions.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Initial Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, status: value as Incident['status'] }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder="e.g., Lekki Free Zone"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="repairCost">Repair Cost (₦)</Label>
                <Input
                  id="repairCost"
                  name="repairCost"
                  type="number"
                  value={formData.repairCost}
                  onChange={handleInputChange}
                  placeholder="e.g., 50000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Describe the incident in detail..."
                  className="w-full min-h-[100px] px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Reporting...' : 'Report Incident'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">Total Incidents</p>
                <p className="text-2xl font-bold">{totalIncidents}</p>
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
                <p className="text-sm text-gray-500">Resolved</p>
                <p className="text-2xl font-bold text-green-600">{resolvedCount}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">Pending</p>
                <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">Total Cost</p>
                <p className="text-2xl font-bold">{formatCurrency(totalCost)}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <CircleDollarSign className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Incidents table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Incidents</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incidents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    No incidents reported
                  </TableCell>
                </TableRow>
              ) : (
                incidents.map((incident) => {
                  const vehicle = vehicles.find((v) => v.id === incident.vehicleId);
                  return (
                    <TableRow key={incident.id}>
                      <TableCell>{format(new Date(incident.date), 'MMM d, yyyy')}</TableCell>
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
                      <TableCell>{incident.title}</TableCell>
                      <TableCell>{getSeverityBadge(incident.severity)}</TableCell>
                      <TableCell>{getStatusBadge(incident.status)}</TableCell>
                      <TableCell>
                        {formatCurrency(incident.finalRepairCost || incident.repairCost)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => openDetailModal(incident)}>
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="w-[95%] max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Incident Details</DialogTitle>
          </DialogHeader>
          {selectedIncident && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Title</p>
                  <p className="font-medium text-lg">{selectedIncident.title}</p>
                </div>
                {getSeverityBadge(selectedIncident.severity)}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Date</p>
                  <p className="font-medium">
                    {format(new Date(selectedIncident.date), 'MMM d, yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Location</p>
                  <p className="font-medium">{selectedIncident.location || '-'}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500">Description</p>
                <p className="font-medium bg-gray-50 p-3 rounded-lg">
                  {selectedIncident.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Estimated Cost</p>
                  <p className="font-medium">{formatCurrency(selectedIncident.repairCost)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Final Cost</p>
                  <p className="font-medium">
                    {selectedIncident.finalRepairCost
                      ? formatCurrency(selectedIncident.finalRepairCost)
                      : '-'}
                  </p>
                </div>
              </div>

              {canManageRecords && (
                <div className="border-t pt-4">
                  <p className="text-sm text-gray-500 mb-2">Update Status</p>
                  <div className="flex gap-2 flex-wrap">
                    {statusOptions.map((status) => (
                      <Button
                        key={status}
                        variant={selectedIncident.status === status ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleStatusUpdate(selectedIncident.id, status as Incident['status'])}
                      >
                        {status}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {canManageRecords && selectedIncident.status !== 'Resolved' && (
                <div className="border-t pt-4">
                  <p className="text-sm text-gray-500 mb-2">Update Final Cost</p>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Enter final repair cost"
                      defaultValue={selectedIncident.finalRepairCost}
                      onBlur={(e) =>
                        handleFinalCostUpdate(selectedIncident.id, parseFloat(e.target.value))
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
