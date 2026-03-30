import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Maintenance, Vehicle } from '@/types';
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
import { Plus, Wrench, AlertCircle, CheckCircle2, Clock, CircleDollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  createMaintenance,
  listMaintenance,
  listOperationalVehicles,
  updateMaintenance,
} from '@/lib/fleet-data';

const serviceTypes = [
  'Oil Change',
  'Tire Replacement',
  'Brake Service',
  'Engine Repair',
  'Transmission',
  'Electrical',
  'Body Work',
  'General Service',
  'Other',
];

export default function Maintenance() {
  const { canManageRecords } = useAuth();
  const [maintenance, setMaintenance] = useState<Maintenance[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    vehicleId: '',
    serviceType: '',
    scheduledDate: new Date().toISOString().split('T')[0],
    cost: '',
    serviceProvider: '',
    description: '',
    status: 'Scheduled' as Maintenance['status'],
  });

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    const maintData = await listMaintenance();
    const sortedMaint = maintData.sort(
      (a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()
    );
    setMaintenance(sortedMaint);

    const allVehicles = await listOperationalVehicles();
    setVehicles(allVehicles);
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
      if (!formData.vehicleId || !formData.serviceType || !formData.scheduledDate || !formData.cost) {
        toast.error('Please fill in all required fields');
        setIsSubmitting(false);
        return;
      }

      const cost = parseFloat(formData.cost);
      if (isNaN(cost)) {
        toast.error('Please enter a valid cost');
        setIsSubmitting(false);
        return;
      }

      const newMaintenance: Maintenance = {
        id: `mnt-${Date.now()}`,
        vehicleId: formData.vehicleId,
        serviceType: formData.serviceType as Maintenance['serviceType'],
        status: formData.status,
        scheduledDate: formData.scheduledDate,
        cost,
        serviceProvider: formData.serviceProvider || undefined,
        description: formData.description || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await createMaintenance(newMaintenance);
      toast.success('Maintenance scheduled successfully');
      setIsAddModalOpen(false);
      resetForm();
      await loadData();
    } catch (error) {
      console.error('Failed to schedule maintenance', error);
      toast.error('Failed to schedule maintenance');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      vehicleId: '',
      serviceType: '',
      scheduledDate: new Date().toISOString().split('T')[0],
      cost: '',
      serviceProvider: '',
      description: '',
      status: 'Scheduled',
    });
  };

  const handleStatusChange = async (id: string, newStatus: Maintenance['status']) => {
    const updates: Partial<Maintenance> = { status: newStatus, updatedAt: new Date().toISOString() };
    if (newStatus === 'Completed') {
      updates.completedDate = new Date().toISOString().split('T')[0];
    }

    try {
      await updateMaintenance(id, {
        status: updates.status,
        completedDate: updates.completedDate,
      });
      toast.success(`Maintenance marked as ${newStatus}`);
      await loadData();
    } catch (error) {
      console.error('Failed to update maintenance status', error);
      toast.error('Failed to update maintenance status');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: Maintenance['status']) => {
    const icons = {
      Completed: CheckCircle2,
      Scheduled: Clock,
      'In Progress': Wrench,
      Overdue: AlertCircle,
    };
    const Icon = icons[status];
    const classes = {
      Completed: 'bg-green-100 text-green-700',
      Scheduled: 'bg-gray-100 text-gray-700',
      'In Progress': 'bg-amber-100 text-amber-700',
      Overdue: 'bg-red-100 text-red-700',
    };
    return (
      <Badge variant="outline" className={`flex items-center gap-1 w-fit ${classes[status]}`}>
        <Icon className="w-3 h-3" />
        {status}
      </Badge>
    );
  };

  // Calculate stats
  const scheduledCount = maintenance.filter((m) => m.status === 'Scheduled').length;
  const overdueCount = maintenance.filter((m) => m.status === 'Overdue').length;
  const inProgressCount = maintenance.filter((m) => m.status === 'In Progress').length;
  const completedCount = maintenance.filter((m) => m.status === 'Completed').length;
  const monthlyCost = maintenance
    .filter((m) => {
      const date = new Date(m.scheduledDate);
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    })
    .reduce((sum, m) => sum + m.cost, 0);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Maintenance</h1>
          <p className="text-gray-500">Schedule and track vehicle maintenance</p>
        </div>
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          {canManageRecords && (
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Schedule Maintenance
              </Button>
            </DialogTrigger>
          )}
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Schedule Maintenance</DialogTitle>
              <DialogDescription>
                Schedule a new maintenance service for a vehicle.
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
                  <Label htmlFor="serviceType">Service Type *</Label>
                  <Select
                    value={formData.serviceType}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, serviceType: value as typeof serviceTypes[number] }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select service type" />
                    </SelectTrigger>
                    <SelectContent>
                      {serviceTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scheduledDate">Scheduled Date *</Label>
                  <Input
                    id="scheduledDate"
                    name="scheduledDate"
                    type="date"
                    value={formData.scheduledDate}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cost">Estimated Cost (₦) *</Label>
                  <Input
                    id="cost"
                    name="cost"
                    type="number"
                    value={formData.cost}
                    onChange={handleInputChange}
                    placeholder="e.g., 50000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serviceProvider">Service Provider</Label>
                  <Input
                    id="serviceProvider"
                    name="serviceProvider"
                    value={formData.serviceProvider}
                    onChange={handleInputChange}
                    placeholder="e.g., Toyota Service Center"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Enter maintenance details..."
                    className="w-full min-h-[80px] px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Scheduling...' : 'Schedule Maintenance'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">Scheduled</p>
                <p className="text-2xl font-bold">{scheduledCount}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">In Progress</p>
                <p className="text-2xl font-bold">{inProgressCount}</p>
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
                <p className="text-sm text-gray-500">Completed</p>
                <p className="text-2xl font-bold">{completedCount}</p>
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
                <p className="text-sm text-gray-500">Overdue</p>
                <p className={`text-2xl font-bold ${overdueCount > 0 ? 'text-red-500' : ''}`}>
                  {overdueCount}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">Monthly Cost</p>
                <p className="text-2xl font-bold">{formatCurrency(monthlyCost)}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <CircleDollarSign className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Maintenance preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Upcoming Maintenance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {maintenance
                .filter((m) => m.status === 'Scheduled')
                .slice(0, 5)
                .map((maint) => {
                  const vehicle = vehicles.find((v) => v.id === maint.vehicleId);
                  return (
                    <div
                      key={maint.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{maint.serviceType}</p>
                        <p className="text-sm text-gray-500">
                          {vehicle?.plateNumber} • {format(new Date(maint.scheduledDate), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <p className="font-medium">{formatCurrency(maint.cost)}</p>
                    </div>
                  );
                })}
              {maintenance.filter((m) => m.status === 'Scheduled').length === 0 && (
                <p className="text-gray-500 text-center py-4">No upcoming maintenance</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Overdue Maintenance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {maintenance
                .filter((m) => m.status === 'Overdue')
                .slice(0, 5)
                .map((maint) => {
                  const vehicle = vehicles.find((v) => v.id === maint.vehicleId);
                  return (
                    <div
                      key={maint.id}
                      className="flex items-center justify-between p-3 bg-red-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{maint.serviceType}</p>
                        <p className="text-sm text-gray-500">
                          {vehicle?.plateNumber} • {format(new Date(maint.scheduledDate), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <p className="font-medium">{formatCurrency(maint.cost)}</p>
                    </div>
                  );
                })}
              {maintenance.filter((m) => m.status === 'Overdue').length === 0 && (
                <p className="text-gray-500 text-center py-4">No overdue maintenance</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Maintenance table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Maintenance Records</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Service Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {maintenance.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    No maintenance records
                  </TableCell>
                </TableRow>
              ) : (
                maintenance.map((maint) => {
                  const vehicle = vehicles.find((v) => v.id === maint.vehicleId);
                  return (
                    <TableRow key={maint.id}>
                      <TableCell>{format(new Date(maint.scheduledDate), 'MMM d, yyyy')}</TableCell>
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
                      <TableCell>{maint.serviceType}</TableCell>
                      <TableCell>{getStatusBadge(maint.status)}</TableCell>
                      <TableCell>{formatCurrency(maint.cost)}</TableCell>
                      <TableCell>{maint.serviceProvider || '-'}</TableCell>
                      <TableCell>
                        {canManageRecords && maint.status !== 'Completed' && (
                          <Select
                            value={maint.status}
                            onValueChange={(value) =>
                              handleStatusChange(maint.id, value as Maintenance['status'])
                            }
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Scheduled">Scheduled</SelectItem>
                              <SelectItem value="In Progress">In Progress</SelectItem>
                              <SelectItem value="Completed">Complete</SelectItem>
                              <SelectItem value="Overdue">Overdue</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
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
