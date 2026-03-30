import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { Document, Vehicle, Driver } from '@/types';
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
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, FileText, Download, FolderOpen, Upload, File, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { listDocuments, uploadDocumentRecord } from '@/lib/documents-data';
import { listOperationalVehiclesAndActiveDrivers } from '@/lib/fleet-data';
import { isSupabaseConfigured } from '@/lib/supabase';

const documentTypes = ['Registration', 'Insurance', 'Service Receipt', 'Purchase Invoice', 'License', 'Other'];
const NO_VEHICLE_VALUE = 'none';
const NO_DRIVER_VALUE = 'none';

export default function Documents() {
  const { canManageRecords } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    documentType: '',
    vehicleId: '',
    driverId: '',
    expiryDate: '',
  });

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    const docData = await listDocuments();
    const sortedDocs = docData.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    setDocuments(sortedDocs);

    const fleetData = await listOperationalVehiclesAndActiveDrivers();
    setVehicles(fleetData.vehicles);
    setDrivers(fleetData.drivers);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Validation
      if (!formData.title || !formData.documentType) {
        toast.error('Please fill in all required fields');
        return;
      }

      if (!selectedFile) {
        toast.error('Please select a file');
        return;
      }

      const fileUrl = isSupabaseConfigured ? '' : await readFileAsDataUrl(selectedFile);

      // Create document record
      const newDocument: Document = {
        id: `doc-${Date.now()}`,
        title: formData.title,
        documentType: formData.documentType as Document['documentType'],
        vehicleId: formData.vehicleId || undefined,
        driverId: formData.driverId || undefined,
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
      toast.error('Failed to upload document');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isExpiringSoon = (expiryDate?: string) => {
    if (!expiryDate) return false;
    const daysUntilExpiry = Math.floor(
      (new Date(expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
  };

  const isExpired = (expiryDate?: string) => {
    if (!expiryDate) return false;
    return new Date(expiryDate).getTime() < new Date().getTime();
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-500">Manage vehicle and driver documents</p>
        </div>
        {canManageRecords && (
          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Upload Document
          </Button>
        )}
      </div>

      {/* Upload Document Modal */}
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
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Upload a new document for a vehicle or driver.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              {/* File upload area */}
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50 transition-colors"
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
                  <div className="flex items-center justify-center gap-2">
                    <File className="w-6 h-6 text-primary" />
                    <div className="text-left">
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Click to select a file</p>
                    <p className="text-xs text-gray-400">PDF, JPG, PNG, DOC up to 10MB</p>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Document Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Vehicle Registration"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="documentType">Document Type *</Label>
                <Select
                  value={formData.documentType}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, documentType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {documentTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicleId">Associated Vehicle</Label>
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
                    <SelectValue placeholder="Select vehicle (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_VEHICLE_VALUE}>None</SelectItem>
                    {vehicles.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.plateNumber} - {vehicle.brand} {vehicle.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="driverId">Associated Driver</Label>
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
                <Label htmlFor="expiryDate">Expiry Date</Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, expiryDate: e.target.value }))
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Upload Document</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Documents grid */}
      {documents.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No documents uploaded</p>
            <p className="text-gray-400 text-sm">Upload documents to manage them here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => {
            const vehicle = doc.vehicleId ? vehicles.find((v) => v.id === doc.vehicleId) : null;
            const driver = doc.driverId ? drivers.find((d) => d.id === doc.driverId) : null;
            const expired = isExpired(doc.expiryDate);
            const expiringSoon = isExpiringSoon(doc.expiryDate);

            return (
              <Card key={doc.id} className="group">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{doc.title}</p>
                        <p className="text-sm text-gray-500">{doc.documentType}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" asChild>
                        <a href={doc.fileUrl} download={doc.fileName}>
                          <Download className="w-4 h-4" />
                        </a>
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1">
                    {vehicle && (
                      <p className="text-sm text-gray-500">
                        Vehicle:{' '}
                        <Link to={`/vehicles/${vehicle.id}`}>
                          <Badge variant="outline" className="cursor-pointer hover:bg-gray-100">
                            {vehicle.plateNumber}
                          </Badge>
                        </Link>
                      </p>
                    )}
                    {driver && <p className="text-sm text-gray-500">Driver: {driver.fullName}</p>}
                    <p className="text-sm text-gray-500">Size: {formatFileSize(doc.fileSize)}</p>
                    {doc.expiryDate && (
                      <p className="text-sm">
                        Expires:{' '}
                        <span className={expired ? 'text-red-500' : expiringSoon ? 'text-amber-500' : ''}>
                          {format(new Date(doc.expiryDate), 'MMM d, yyyy')}
                        </span>
                        {expired && (
                          <Badge variant="destructive" className="ml-2 text-xs">
                            Expired
                          </Badge>
                        )}
                        {expiringSoon && !expired && (
                          <Badge variant="secondary" className="ml-2 text-xs bg-amber-500 text-white">
                            Expiring Soon
                          </Badge>
                        )}
                      </p>
                    )}
                  </div>

                  <p className="text-xs text-gray-400 mt-3">
                    Uploaded {format(new Date(doc.uploadedAt), 'MMM d, yyyy')}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

    </div>
  );
}
