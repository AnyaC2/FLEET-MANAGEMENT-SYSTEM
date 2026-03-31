import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Document, DocumentAudience, DocumentTypeOption, Driver, Vehicle } from '@/types';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, FileText, Download, FolderOpen, Upload, File, X, Car, Users, Search, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  createDocumentType,
  listDocuments,
  listDocumentTypes,
  uploadDocumentRecord,
} from '@/lib/documents-data';
import { listOperationalVehiclesAndActiveDrivers } from '@/lib/fleet-data';
import { isSupabaseConfigured } from '@/lib/supabase';

const NO_VEHICLE_VALUE = 'none';
const NO_DRIVER_VALUE = 'none';
const NO_DOCUMENT_TYPE_VALUE = 'all-types';

type SortOption = 'expirySoonest' | 'expiryLatest' | 'uploadedNewest' | 'uploadedOldest' | 'titleAsc';
type StatusFilter = 'all' | 'expiring' | 'expired' | 'valid' | 'noExpiry';

function getDocumentAudience(document: Document): DocumentAudience {
  return document.driverId ? 'driver' : 'vehicle';
}

export default function Documents() {
  const { canManageRecords } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeOption[]>([]);
  const [activeTab, setActiveTab] = useState<DocumentAudience>('vehicle');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedDocumentType, setSelectedDocumentType] = useState(NO_DOCUMENT_TYPE_VALUE);
  const [sortBy, setSortBy] = useState<SortOption>('expirySoonest');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    title: '',
    audience: 'vehicle' as DocumentAudience,
    documentType: '',
    vehicleId: '',
    driverId: '',
    expiryDate: '',
  });
  const [customTypeData, setCustomTypeData] = useState({
    name: '',
    appliesTo: 'vehicle' as DocumentAudience | 'both',
  });

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    const [docData, fleetData, typeData] = await Promise.all([
      listDocuments(),
      listOperationalVehiclesAndActiveDrivers(),
      listDocumentTypes(),
    ]);

    setDocuments(docData.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()));
    setVehicles(fleetData.vehicles);
    setDrivers(fleetData.drivers);
    setDocumentTypes(typeData);
  };

  const visibleDocumentTypes = useMemo(
    () =>
      documentTypes.filter(
        (type) => type.appliesTo === activeTab || type.appliesTo === 'both'
      ),
    [activeTab, documentTypes]
  );

  const formDocumentTypes = useMemo(
    () =>
      documentTypes.filter(
        (type) => type.appliesTo === formData.audience || type.appliesTo === 'both'
      ),
    [documentTypes, formData.audience]
  );

  const filteredDocuments = useMemo(() => {
    const now = new Date();

    return documents
      .filter((document) => getDocumentAudience(document) === activeTab)
      .filter((document) => {
        const normalizedSearch = searchQuery.trim().toLowerCase();
        if (!normalizedSearch) {
          return true;
        }

        const linkedVehicle = document.vehicleId ? vehicles.find((vehicle) => vehicle.id === document.vehicleId) : null;
        const linkedDriver = document.driverId ? drivers.find((driver) => driver.id === document.driverId) : null;

        return [
          document.title,
          document.documentType,
          linkedVehicle?.plateNumber,
          linkedVehicle ? `${linkedVehicle.brand} ${linkedVehicle.model}` : '',
          linkedDriver?.fullName,
          document.fileName,
        ]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(normalizedSearch));
      })
      .filter((document) => {
        if (selectedDocumentType === NO_DOCUMENT_TYPE_VALUE) {
          return true;
        }
        return document.documentType === selectedDocumentType;
      })
      .filter((document) => {
        if (statusFilter === 'all') {
          return true;
        }

        if (!document.expiryDate) {
          return statusFilter === 'noExpiry';
        }

        const expiry = new Date(document.expiryDate);
        const daysUntilExpiry = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        switch (statusFilter) {
          case 'expired':
            return expiry.getTime() < now.getTime();
          case 'expiring':
            return daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
          case 'valid':
            return daysUntilExpiry > 30;
          default:
            return true;
        }
      })
      .sort((left, right) => {
        switch (sortBy) {
          case 'expirySoonest': {
            const leftExpiry = left.expiryDate ? new Date(left.expiryDate).getTime() : Number.MAX_SAFE_INTEGER;
            const rightExpiry = right.expiryDate ? new Date(right.expiryDate).getTime() : Number.MAX_SAFE_INTEGER;
            return leftExpiry - rightExpiry;
          }
          case 'expiryLatest': {
            const leftExpiry = left.expiryDate ? new Date(left.expiryDate).getTime() : Number.MIN_SAFE_INTEGER;
            const rightExpiry = right.expiryDate ? new Date(right.expiryDate).getTime() : Number.MIN_SAFE_INTEGER;
            return rightExpiry - leftExpiry;
          }
          case 'uploadedOldest':
            return new Date(left.uploadedAt).getTime() - new Date(right.uploadedAt).getTime();
          case 'titleAsc':
            return left.title.localeCompare(right.title);
          case 'uploadedNewest':
          default:
            return new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime();
        }
      });
  }, [activeTab, documents, drivers, searchQuery, selectedDocumentType, sortBy, statusFilter, vehicles]);

  const summary = useMemo(() => {
    const currentDocuments = documents.filter((document) => getDocumentAudience(document) === activeTab);
    const now = new Date();

    return {
      total: currentDocuments.length,
      expired: currentDocuments.filter((document) => document.expiryDate && new Date(document.expiryDate).getTime() < now.getTime()).length,
      expiringSoon: currentDocuments.filter((document) => {
        if (!document.expiryDate) {
          return false;
        }
        const daysUntilExpiry = Math.floor((new Date(document.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntilExpiry >= 0 && daysUntilExpiry <= 30;
      }).length,
    };
  }, [activeTab, documents]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

  const resetForm = () => {
    setFormData({
      title: '',
      audience: activeTab,
      documentType: '',
      vehicleId: '',
      driverId: '',
      expiryDate: '',
    });
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      if (!formData.title || !formData.documentType) {
        toast.error('Please fill in all required fields');
        return;
      }

      if (formData.audience === 'vehicle' && !formData.vehicleId) {
        toast.error('Please select the vehicle this document belongs to');
        return;
      }

      if (formData.audience === 'driver' && !formData.driverId) {
        toast.error('Please select the driver this document belongs to');
        return;
      }

      if (!selectedFile) {
        toast.error('Please select a file');
        return;
      }

      const fileUrl = isSupabaseConfigured ? '' : await readFileAsDataUrl(selectedFile);

      const newDocument: Document = {
        id: `doc-${Date.now()}`,
        title: formData.title,
        documentType: formData.documentType,
        vehicleId: formData.audience === 'vehicle' ? formData.vehicleId : undefined,
        driverId: formData.audience === 'driver' ? formData.driverId : undefined,
        fileUrl,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        expiryDate: formData.expiryDate || undefined,
        uploadedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await uploadDocumentRecord(newDocument, selectedFile);
      toast.success('Document uploaded successfully');
      setIsAddModalOpen(false);
      resetForm();
      await loadData();
    } catch (error) {
      console.error('Failed to upload document.', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload document');
    }
  };

  const handleCreateDocumentType = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      if (!customTypeData.name.trim()) {
        toast.error('Enter a document type name');
        return;
      }

      const createdType = await createDocumentType({
        name: customTypeData.name,
        appliesTo: customTypeData.appliesTo,
      });

      toast.success('Document type added');
      setDocumentTypes((previous) =>
        [...previous.filter((item) => item.name.toLowerCase() !== createdType.name.toLowerCase()), createdType].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );
      setFormData((previous) => ({
        ...previous,
        documentType:
          createdType.appliesTo === 'both' || createdType.appliesTo === previous.audience
            ? createdType.name
            : previous.documentType,
      }));
      setCustomTypeData({ name: '', appliesTo: formData.audience });
      setIsTypeModalOpen(false);
    } catch (error) {
      console.error('Failed to create document type.', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add document type');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const units = ['Bytes', 'KB', 'MB', 'GB'];
    const index = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${parseFloat((bytes / Math.pow(1024, index)).toFixed(2))} ${units[index]}`;
  };

  const getExpiryMeta = (expiryDate?: string) => {
    if (!expiryDate) {
      return { label: 'No expiry', tone: 'muted' as const };
    }

    const now = new Date();
    const expiry = new Date(expiryDate);
    const daysUntilExpiry = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (expiry.getTime() < now.getTime()) {
      return { label: 'Expired', tone: 'expired' as const };
    }

    if (daysUntilExpiry <= 30) {
      return { label: 'Expiring Soon', tone: 'warning' as const };
    }

    return { label: 'Valid', tone: 'valid' as const };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-500">Organize vehicle and driver documents with expiry tracking and shared document types.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {canManageRecords && (
            <Button onClick={() => {
              setFormData({
                title: '',
                audience: activeTab,
                documentType: '',
                vehicleId: '',
                driverId: '',
                expiryDate: '',
              });
              setSelectedFile(null);
              setIsAddModalOpen(true);
            }}>
              <Upload className="mr-2 h-4 w-4" />
              Upload Document
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => {
        setActiveTab(value as DocumentAudience);
        setSelectedDocumentType(NO_DOCUMENT_TYPE_VALUE);
        setStatusFilter('all');
        setSearchQuery('');
        setSortBy('expirySoonest');
      }}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="vehicle">
            <Car className="mr-2 h-4 w-4" />
            Vehicle Documents
          </TabsTrigger>
          <TabsTrigger value="driver">
            <Users className="mr-2 h-4 w-4" />
            Driver Documents
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vehicle" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-gray-500">Total Vehicle Documents</p>
                <p className="mt-2 text-3xl font-bold">{summary.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-gray-500">Expiring Soon</p>
                <p className="mt-2 text-3xl font-bold text-amber-600">{summary.expiringSoon}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-gray-500">Expired</p>
                <p className="mt-2 text-3xl font-bold text-red-600">{summary.expired}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="driver" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-gray-500">Total Driver Documents</p>
                <p className="mt-2 text-3xl font-bold">{summary.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-gray-500">Expiring Soon</p>
                <p className="mt-2 text-3xl font-bold text-amber-600">{summary.expiringSoon}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-gray-500">Expired</p>
                <p className="mt-2 text-3xl font-bold text-red-600">{summary.expired}</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <SlidersHorizontal className="h-5 w-5" />
            Filters & Sorting
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="document-search">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                id="document-search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={`Search ${activeTab} documents`}
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Document Type</Label>
            <Select value={selectedDocumentType} onValueChange={setSelectedDocumentType}>
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_DOCUMENT_TYPE_VALUE}>All types</SelectItem>
                {visibleDocumentTypes.map((type) => (
                  <SelectItem key={type.id} value={type.name}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="expiring">Expiring soon</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="valid">Valid</SelectItem>
                <SelectItem value="noExpiry">No expiry</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Sort By</Label>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
              <SelectTrigger>
                <SelectValue placeholder="Sort documents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expirySoonest">Expiry soonest first</SelectItem>
                <SelectItem value="expiryLatest">Expiry latest first</SelectItem>
                <SelectItem value="uploadedNewest">Recently uploaded</SelectItem>
                <SelectItem value="uploadedOldest">Oldest uploaded</SelectItem>
                <SelectItem value="titleAsc">Title A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={isAddModalOpen}
        onOpenChange={(open) => {
          setIsAddModalOpen(open);
          if (!open) {
            resetForm();
          }
        }}
      >
        <DialogContent className="w-[95%] max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Add a document for a vehicle or a driver. The document type list is shared across the whole system.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Document For</Label>
                <Select
                  value={formData.audience}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      audience: value as DocumentAudience,
                      documentType: '',
                      vehicleId: '',
                      driverId: '',
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vehicle">Vehicle</SelectItem>
                    <SelectItem value="driver">Driver</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="document-title">Document Title *</Label>
                <Input
                  id="document-title"
                  value={formData.title}
                  onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder={formData.audience === 'vehicle' ? 'e.g., 2026 Road Worthiness Certificate' : 'e.g., Driver License Copy'}
                />
              </div>
            </div>

            <div
              className="cursor-pointer rounded-xl border-2 border-dashed border-gray-300 p-6 text-center transition-colors hover:bg-gray-50"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileSelect}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              />
              {selectedFile ? (
                <div className="flex items-center justify-center gap-3">
                  <File className="h-7 w-7 text-primary" />
                  <div className="text-left">
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    className="rounded p-1 hover:bg-gray-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                  <p className="text-sm text-gray-600">Click to select a file</p>
                  <p className="text-xs text-gray-400">PDF, JPG, PNG, DOC up to 10MB</p>
                </>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label>Document Type *</Label>
                  {canManageRecords && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto px-0 text-primary"
                      onClick={() => {
                        setCustomTypeData({ name: '', appliesTo: formData.audience });
                        setIsTypeModalOpen(true);
                      }}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Add new type
                    </Button>
                  )}
                </div>
                <Select
                  value={formData.documentType}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, documentType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {formDocumentTypes.map((type) => (
                      <SelectItem key={type.id} value={type.name}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="document-expiry">Expiry Date</Label>
                <Input
                  id="document-expiry"
                  type="date"
                  value={formData.expiryDate}
                  onChange={(event) => setFormData((prev) => ({ ...prev, expiryDate: event.target.value }))}
                />
              </div>
            </div>

            {formData.audience === 'vehicle' ? (
              <div className="space-y-2">
                <Label>Associated Vehicle *</Label>
                <Select
                  value={formData.vehicleId || NO_VEHICLE_VALUE}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      vehicleId: value === NO_VEHICLE_VALUE ? '' : value,
                      driverId: '',
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_VEHICLE_VALUE}>Select vehicle</SelectItem>
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.plateNumber} - {vehicle.brand} {vehicle.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Associated Driver *</Label>
                <Select
                  value={formData.driverId || NO_DRIVER_VALUE}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      driverId: value === NO_DRIVER_VALUE ? '' : value,
                      vehicleId: '',
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select driver" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_DRIVER_VALUE}>Select driver</SelectItem>
                    {drivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Upload Document</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isTypeModalOpen} onOpenChange={setIsTypeModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Document Type</DialogTitle>
            <DialogDescription>
              This type will become available to everyone in the system.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateDocumentType} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="custom-document-type">Type Name</Label>
              <Input
                id="custom-document-type"
                value={customTypeData.name}
                onChange={(event) => setCustomTypeData((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="e.g., Vehicle Inspection Report"
              />
            </div>
            <div className="space-y-2">
              <Label>Applies To</Label>
              <Select
                value={customTypeData.appliesTo}
                onValueChange={(value) =>
                  setCustomTypeData((prev) => ({
                    ...prev,
                    appliesTo: value as DocumentAudience | 'both',
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vehicle">Vehicle only</SelectItem>
                  <SelectItem value="driver">Driver only</SelectItem>
                  <SelectItem value="both">Both vehicle and driver</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsTypeModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Type</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {filteredDocuments.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FolderOpen className="mx-auto mb-4 h-16 w-16 text-gray-300" />
            <p className="text-lg text-gray-500">No {activeTab} documents found</p>
            <p className="text-sm text-gray-400">Try adjusting your filters or upload a new document.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredDocuments.map((document) => {
            const vehicle = document.vehicleId ? vehicles.find((item) => item.id === document.vehicleId) : null;
            const driver = document.driverId ? drivers.find((item) => item.id === document.driverId) : null;
            const expiryMeta = getExpiryMeta(document.expiryDate);

            return (
              <Card key={document.id} className="overflow-hidden border-gray-200">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-gray-900">{document.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{document.documentType}</Badge>
                          <Badge
                            className={
                              expiryMeta.tone === 'expired'
                                ? 'bg-red-100 text-red-700 hover:bg-red-100'
                                : expiryMeta.tone === 'warning'
                                  ? 'bg-amber-100 text-amber-700 hover:bg-amber-100'
                                  : expiryMeta.tone === 'valid'
                                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-100'
                            }
                          >
                            {expiryMeta.label}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <Button variant="ghost" size="icon" asChild>
                      <a href={document.fileUrl} download={document.fileName}>
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm text-gray-600 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-400">Linked Record</p>
                      {vehicle ? (
                        <Link to={`/vehicles/${vehicle.id}`} className="font-medium text-primary hover:underline">
                          {vehicle.plateNumber} - {vehicle.brand} {vehicle.model}
                        </Link>
                      ) : driver ? (
                        <Link to={`/drivers/${driver.id}`} className="font-medium text-primary hover:underline">
                          {driver.fullName}
                        </Link>
                      ) : (
                        <p className="font-medium text-gray-500">Not linked</p>
                      )}
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-400">Expiry</p>
                      <p className="font-medium">
                        {document.expiryDate ? format(new Date(document.expiryDate), 'MMM d, yyyy') : 'No expiry date'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-400">File</p>
                      <p className="font-medium">{document.fileName}</p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-400">Uploaded</p>
                      <p className="font-medium">{format(new Date(document.uploadedAt), 'MMM d, yyyy')}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t pt-4 text-sm text-gray-500">
                    <span>{formatFileSize(document.fileSize)}</span>
                    <span>{activeTab === 'vehicle' ? 'Vehicle document' : 'Driver document'}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
