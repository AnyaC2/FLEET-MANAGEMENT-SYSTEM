import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Vehicle, VehicleStatus, VehicleType } from '@/types';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
import { Plus, Search, Filter, Car, Eye } from 'lucide-react';
import { toast } from 'sonner';
import {
  createVehicle,
  findVehicleByPlateNumber,
  listVehicles,
  updateVehicleStatus,
} from '@/lib/fleet-data';

const vehicleTypes: VehicleType[] = ['Truck', 'Bus', 'SUV', 'Sedan', 'Van', 'Pickup', 'Motorcycle', 'Other'];
const vehicleStatuses: VehicleStatus[] = ['Active', 'Idle', 'Under Maintenance', 'Decommissioned'];
const editableVehicleStatuses: VehicleStatus[] = ['Active', 'Idle', 'Decommissioned'];

export default function Vehicles() {
  const { canManageRecords } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<VehicleStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<VehicleType | 'all'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    plateNumber: '',
    vehicleType: '' as VehicleType | '',
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    vin: '',
    engineNumber: '',
    purchaseDate: '',
    purchaseCost: '',
    vendor: '',
    warrantyExpiry: '',
    currentOdometer: '',
    status: 'Active' as VehicleStatus,
  });

  useEffect(() => {
    void loadVehicles();
  }, []);

  const loadVehicles = async () => {
    const allVehicles = await listVehicles();
    setVehicles(allVehicles);
  };

  const filteredVehicles = vehicles.filter((vehicle) => {
    const matchesSearch =
      vehicle.plateNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.model.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || vehicle.status === statusFilter;
    const matchesType = typeFilter === 'all' || vehicle.vehicleType === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validation
      if (!formData.plateNumber || !formData.vehicleType || !formData.brand || !formData.model) {
        toast.error('Please fill in all required fields');
        setIsSubmitting(false);
        return;
      }

      // VIN validation (17 characters)
      if (formData.vin && formData.vin.length !== 17) {
        toast.error('VIN must be exactly 17 characters');
        setIsSubmitting(false);
        return;
      }

      // Check for duplicate plate number
      const existing = await findVehicleByPlateNumber(formData.plateNumber);
      if (existing) {
        toast.error('A vehicle with this plate number already exists');
        setIsSubmitting(false);
        return;
      }

      const newVehicle: Vehicle = {
        id: `veh-${Date.now()}`,
        plateNumber: formData.plateNumber,
        vehicleType: formData.vehicleType as VehicleType,
        brand: formData.brand,
        model: formData.model,
        year: Number(formData.year),
        vin: formData.vin || undefined,
        engineNumber: formData.engineNumber || undefined,
        purchaseDate: formData.purchaseDate || undefined,
        purchaseCost: formData.purchaseCost ? Number(formData.purchaseCost) : undefined,
        vendor: formData.vendor || undefined,
        warrantyExpiry: formData.warrantyExpiry || undefined,
        currentOdometer: formData.currentOdometer ? Number(formData.currentOdometer) : undefined,
        status: formData.status,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await createVehicle(newVehicle);
      toast.success('Vehicle added successfully');
      setIsAddModalOpen(false);
      resetForm();
      await loadVehicles();
    } catch (error) {
      toast.error('Failed to add vehicle');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      plateNumber: '',
      vehicleType: '',
      brand: '',
      model: '',
      year: new Date().getFullYear(),
      vin: '',
      engineNumber: '',
      purchaseDate: '',
      purchaseCost: '',
      vendor: '',
      warrantyExpiry: '',
      currentOdometer: '',
      status: 'Active',
    });
  };

  const handleStatusChange = async (vehicleId: string, status: VehicleStatus) => {
    try {
      await updateVehicleStatus(vehicleId, status);
      toast.success(`Vehicle marked ${status.toLowerCase()}`);
      await loadVehicles();
    } catch (error) {
      toast.error('Failed to update vehicle status');
    }
  };

  const getStatusBadge = (status: VehicleStatus) => {
    const classes: Record<VehicleStatus, string> = {
      Active: 'bg-green-100 text-green-700',
      Idle: 'bg-gray-100 text-gray-700',
      'Under Maintenance': 'bg-amber-100 text-amber-700',
      Decommissioned: 'bg-red-100 text-red-700',
    };
    return <Badge variant="outline" className={classes[status]}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vehicles</h1>
          <p className="text-gray-500">Manage your fleet vehicles</p>
        </div>
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          {canManageRecords && (
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Vehicle
              </Button>
            </DialogTrigger>
          )}
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Vehicle</DialogTitle>
              <DialogDescription>
                Enter the vehicle details below. All fields marked with * are required.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="plateNumber">Plate Number *</Label>
                  <Input
                    id="plateNumber"
                    name="plateNumber"
                    value={formData.plateNumber}
                    onChange={handleInputChange}
                    placeholder="e.g., LAG-123-AA"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vehicleType">Vehicle Type *</Label>
                  <Select
                    value={formData.vehicleType}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, vehicleType: value as VehicleType }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicleTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand">Brand *</Label>
                  <Input
                    id="brand"
                    name="brand"
                    value={formData.brand}
                    onChange={handleInputChange}
                    placeholder="e.g., Toyota"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model *</Label>
                  <Input
                    id="model"
                    name="model"
                    value={formData.model}
                    onChange={handleInputChange}
                    placeholder="e.g., Land Cruiser"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">Year *</Label>
                  <Input
                    id="year"
                    name="year"
                    type="number"
                    value={formData.year}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, status: value as VehicleStatus }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicleStatuses.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vin">VIN Number</Label>
                  <Input
                    id="vin"
                    name="vin"
                    value={formData.vin}
                    onChange={handleInputChange}
                    placeholder="Enter 17-digit VIN"
                    maxLength={17}
                  />
                  {formData.vin && formData.vin.length !== 17 && (
                    <p className="text-xs text-red-500">VIN must be exactly 17 characters</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="engineNumber">Engine Number</Label>
                  <Input
                    id="engineNumber"
                    name="engineNumber"
                    value={formData.engineNumber}
                    onChange={handleInputChange}
                    placeholder="Enter engine number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchaseDate">Purchase Date</Label>
                  <Input
                    id="purchaseDate"
                    name="purchaseDate"
                    type="date"
                    value={formData.purchaseDate}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="purchaseCost">Purchase Cost (₦)</Label>
                  <Input
                    id="purchaseCost"
                    name="purchaseCost"
                    type="number"
                    value={formData.purchaseCost}
                    onChange={handleInputChange}
                    placeholder="e.g., 45000000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vendor">Vendor</Label>
                  <Input
                    id="vendor"
                    name="vendor"
                    value={formData.vendor}
                    onChange={handleInputChange}
                    placeholder="e.g., Toyota Nigeria Limited"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currentOdometer">Current Odometer (km)</Label>
                  <Input
                    id="currentOdometer"
                    name="currentOdometer"
                    type="number"
                    min="0"
                    value={formData.currentOdometer}
                    onChange={handleInputChange}
                    placeholder="e.g., 15234"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="warrantyExpiry">Warranty Expiry</Label>
                  <Input
                    id="warrantyExpiry"
                    name="warrantyExpiry"
                    type="date"
                    value={formData.warrantyExpiry}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Adding...' : 'Add Vehicle'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by plate, brand, or model..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as VehicleStatus | 'all')}>
                <SelectTrigger className="w-40">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {vehicleStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as VehicleType | 'all')}>
                <SelectTrigger className="w-40">
                  <Car className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {vehicleTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vehicles table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
                <TableRow>
                  <TableHead>Plate Number</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Odometer</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVehicles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    No vehicles found
                  </TableCell>
                </TableRow>
              ) : (
                filteredVehicles.map((vehicle) => (
                  <TableRow key={vehicle.id}>
                    <TableCell className="font-medium">{vehicle.plateNumber}</TableCell>
                    <TableCell>
                      {vehicle.brand} {vehicle.model}
                    </TableCell>
                    <TableCell>{vehicle.vehicleType}</TableCell>
                    <TableCell>{getStatusBadge(vehicle.status)}</TableCell>
                    <TableCell>
                      {vehicle.currentOdometer !== undefined ? `${vehicle.currentOdometer.toLocaleString()} km` : '-'}
                    </TableCell>
                    <TableCell>{vehicle.year}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {canManageRecords && (
                          <Select
                            value={vehicle.status}
                            onValueChange={(value) => void handleStatusChange(vehicle.id, value as VehicleStatus)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {editableVehicleStatuses.map((status) => (
                                <SelectItem key={status} value={status}>
                                  {status}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <Link to={`/vehicles/${vehicle.id}`}>
                          <Button variant="ghost" size="icon">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
