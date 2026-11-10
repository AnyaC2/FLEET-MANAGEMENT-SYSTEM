import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { Driver, Vehicle } from '@/types';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
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
import { Plus, Search, User, Eye, Download } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { createDriver, listVehiclesAndDrivers, updateDriverStatus } from '@/lib/fleet-data';
import { exportWorkbook } from '@/lib/excel-export';

export default function Drivers() {
  const { canManageRecords } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedStatus = searchParams.get('status');
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Active' | 'Inactive'>(() =>
    requestedStatus === 'Active' || requestedStatus === 'Inactive' ? requestedStatus : 'all'
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
    email: '',
    licenseNumber: '',
    licenseExpiry: '',
    dateOfBirth: '',
    hireDate: '',
    address: '',
    status: 'Active' as 'Active' | 'Inactive',
  });

  useEffect(() => {
    void loadDrivers();
  }, []);

  const loadDrivers = async () => {
    const data = await listVehiclesAndDrivers();
    setDrivers(data.drivers);
    setVehicles(data.vehicles);
  };

  const filteredDrivers = drivers.filter((driver) => {
    const matchesSearch =
      driver.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.licenseNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.phoneNumber.includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || driver.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  const driverPageCount = Math.max(1, Math.ceil(filteredDrivers.length / pageSize));
  const visibleDriverPage = Math.min(currentPage, driverPageCount);
  const paginatedDrivers = filteredDrivers.slice(
    (visibleDriverPage - 1) * pageSize,
    visibleDriverPage * pageSize
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validation
      if (!formData.fullName || !formData.phoneNumber || !formData.licenseNumber || !formData.licenseExpiry) {
        toast.error('Please fill in all required fields');
        setIsSubmitting(false);
        return;
      }

      const newDriver: Driver = {
        id: `drv-${Date.now()}`,
        fullName: formData.fullName,
        phoneNumber: formData.phoneNumber,
        email: formData.email || undefined,
        licenseNumber: formData.licenseNumber,
        licenseExpiry: formData.licenseExpiry,
        dateOfBirth: formData.dateOfBirth || undefined,
        hireDate: formData.hireDate || undefined,
        address: formData.address || undefined,
        status: formData.status,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await createDriver(newDriver);
      toast.success('Driver added successfully');
      setIsAddModalOpen(false);
      resetForm();
      await loadDrivers();
    } catch {
      toast.error('Failed to add driver');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      fullName: '',
      phoneNumber: '',
      email: '',
      licenseNumber: '',
      licenseExpiry: '',
      dateOfBirth: '',
      hireDate: '',
      address: '',
      status: 'Active',
    });
  };

  const handleStatusChange = async (driverId: string, status: Driver['status']) => {
    try {
      await updateDriverStatus(driverId, status);
      toast.success(`Driver marked ${status.toLowerCase()}`);
      await loadDrivers();
    } catch {
      toast.error('Failed to update driver status');
    }
  };

  const getAssignedVehicle = (driverId: string): Vehicle | undefined => {
    return vehicles
      .filter((vehicle) => vehicle.currentDriverId === driverId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
  };

  const handleExportDriversReport = () => {
    exportWorkbook({
      filename: `drivers-report-${new Date().toISOString().split('T')[0]}.xlsx`,
      sheets: [
        {
          name: 'Drivers',
          rows: filteredDrivers.map((driver) => {
            const assignedVehicle = getAssignedVehicle(driver.id);
            return {
              'Full Name': driver.fullName,
              'Phone Number': driver.phoneNumber,
              Email: driver.email ?? '-',
              'License Number': driver.licenseNumber,
              'License Expiry': format(new Date(driver.licenseExpiry), 'MMM d, yyyy'),
              Status: driver.status,
              'Assigned Vehicle': assignedVehicle ? assignedVehicle.plateNumber : '-',
            };
          }),
        },
      ],
    });
    toast.success('Drivers report downloaded');
  };

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="lfz-enter flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.035em] text-gray-900 sm:text-[2.25rem]">Drivers</h1>
          <p className="mt-1.5 text-sm text-gray-500">Manage drivers, licences, and vehicle assignments.</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button variant="outline" onClick={handleExportDriversReport}>
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          {canManageRecords && (
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Driver
              </Button>
            </DialogTrigger>
          )}
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Driver</DialogTitle>
              <DialogDescription>
                Enter the driver details below. All fields marked with * are required.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    placeholder="e.g., John Adeyemi"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number *</Label>
                  <Input
                    id="phoneNumber"
                    name="phoneNumber"
                    value={formData.phoneNumber}
                    onChange={handleInputChange}
                    placeholder="e.g., +234 801 234 5678"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="licenseNumber">License Number *</Label>
                  <Input
                    id="licenseNumber"
                    name="licenseNumber"
                    value={formData.licenseNumber}
                    onChange={handleInputChange}
                    placeholder="e.g., DL-12345678"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="licenseExpiry">License Expiry *</Label>
                  <Input
                    id="licenseExpiry"
                    name="licenseExpiry"
                    type="date"
                    value={formData.licenseExpiry}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, status: value as 'Active' | 'Inactive' }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Accordion type="single" collapsible className="rounded-xl border border-gray-200 px-4 sm:col-span-2">
                  <AccordionItem value="additional" className="border-0">
                    <AccordionTrigger className="hover:no-underline">
                      <span>
                        Additional details
                        <span className="mt-1 block text-xs font-normal text-gray-500">Email, personal dates and residential address</span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="email">Email</Label>
                          <Input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} placeholder="e.g., john@lfzdc.com" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dateOfBirth">Date of Birth</Label>
                          <Input id="dateOfBirth" name="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={handleInputChange} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="hireDate">Hire Date</Label>
                          <Input id="hireDate" name="hireDate" type="date" value={formData.hireDate} onChange={handleInputChange} />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="address">Home Address</Label>
                          <textarea id="address" name="address" value={formData.address} onChange={handleInputChange} placeholder="Enter full residential address" className="w-full min-h-[80px] px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Adding...' : 'Add Driver'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card className="gap-0 overflow-hidden py-0">
        <CardContent className="border-b border-gray-200 p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name, license, or phone..."
                aria-label="Search drivers"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as typeof statusFilter); setCurrentPage(1); }}>
              <SelectTrigger aria-label="Filter drivers by status" className="w-40">
                <User className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm text-gray-500" role="status">
          <span>{filteredDrivers.length} of {drivers.length} drivers</span>
          {(searchQuery || statusFilter !== 'all') && (
            <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(''); setStatusFilter('all'); setCurrentPage(1); }}>
              Clear filters
            </Button>
          )}
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Driver</TableHead>
                <TableHead>License</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned Vehicle</TableHead>
                <TableHead>License Expiry</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDrivers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    <p className="font-medium text-gray-900">{drivers.length ? 'No matching drivers' : 'No drivers registered yet'}</p>
                    <p className="mt-1 text-sm">{drivers.length ? 'Try a different name or clear the filters.' : 'Add or import a driver to start recording assignments.'}</p>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedDrivers.map((driver) => {
                  const assignedVehicle = getAssignedVehicle(driver.id);
                  const daysUntilExpiry = (new Date(`${driver.licenseExpiry.slice(0, 10)}T23:59:59`).getTime() - Date.now()) / 86_400_000;
                  const isLicenseExpired = daysUntilExpiry < 0;
                  const isLicenseExpiring = !isLicenseExpired && daysUntilExpiry < 90;

                  return (
                    <TableRow key={driver.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <Link to={`/drivers/${driver.id}`} className="font-medium text-primary hover:underline">{driver.fullName}</Link>
                            <p className="text-sm text-gray-500">{driver.phoneNumber}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{driver.licenseNumber}</TableCell>
                      <TableCell>
                        <Badge variant={driver.status === 'Active' ? 'default' : 'secondary'}
                          className={driver.status === 'Active' ? 'border-green-200 bg-green-50 text-green-800' : ''}
                        >
                          {driver.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {assignedVehicle ? (
                          <Link to={`/vehicles/${assignedVehicle.id}`}>
                            <Badge variant="outline" className="cursor-pointer hover:bg-gray-100">
                              {assignedVehicle.plateNumber}
                            </Badge>
                          </Link>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={isLicenseExpired ? 'text-red-700 font-medium' : isLicenseExpiring ? 'text-amber-700 font-medium' : ''}>
                          {format(new Date(driver.licenseExpiry), 'MMM d, yyyy')}
                        </span>
                        {(isLicenseExpired || isLicenseExpiring) && (
                          <Badge variant="outline" className={`ml-2 text-xs ${isLicenseExpired ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                            {isLicenseExpired ? 'Expired' : 'Expiring soon'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {canManageRecords && (
                            <Select
                              value={driver.status}
                              onValueChange={(value) => void handleStatusChange(driver.id, value as Driver['status'])}
                            >
                              <SelectTrigger aria-label={`Change status for ${driver.fullName}`} className="w-28">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Active">Active</SelectItem>
                                <SelectItem value="Inactive">Inactive</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                            <Button asChild variant="ghost" size="icon">
                              <Link to={`/drivers/${driver.id}`} aria-label={`View ${driver.fullName}`}>
                              <Eye className="w-4 h-4" />
                              </Link>
                            </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
        <RegisterPagination
          currentPage={visibleDriverPage}
          itemLabel="drivers"
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
          pageSize={pageSize}
          totalItems={filteredDrivers.length}
        />
      </Card>
    </div>
  );
}
