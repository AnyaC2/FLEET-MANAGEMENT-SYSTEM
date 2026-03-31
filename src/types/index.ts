// User Roles
export type UserRole =
  | 'editor'
  | 'end_user'
  | 'admin'
  | 'system_admin'
  | 'admin_officer'
  | 'fleet_manager'
  | 'operations_officer'
  | 'maintenance_officer'
  | 'viewer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  department?: string;
  status?: string;
  createdAt: string;
}

// Vehicle Types
export type VehicleType = 'Truck' | 'Bus' | 'SUV' | 'Sedan' | 'Van' | 'Pickup' | 'Motorcycle' | 'Other';
export type VehicleStatus = 'Active' | 'Idle' | 'Under Maintenance' | 'Decommissioned';

export interface Vehicle {
  id: string;
  plateNumber: string;
  vehicleType: VehicleType;
  brand: string;
  model: string;
  year: number;
  vin?: string;
  engineNumber?: string;
  purchaseDate?: string;
  purchaseCost?: number;
  vendor?: string;
  warrantyExpiry?: string;
  status: VehicleStatus;
  currentOdometer?: number;
  nextServiceDueOdometer?: number;
  currentDriverId?: string;
  createdAt: string;
  updatedAt: string;
}

// Driver Types
export interface Driver {
  id: string;
  fullName: string;
  phoneNumber: string;
  email?: string;
  licenseNumber: string;
  licenseExpiry: string;
  dateOfBirth?: string;
  hireDate?: string;
  address?: string;
  status: 'Active' | 'Inactive';
  createdAt: string;
  updatedAt: string;
}

// Assignment Types
export interface Assignment {
  id: string;
  vehicleId: string;
  driverId: string;
  startDate: string;
  endDate?: string;
  createdAt: string;
}

// Fuel Log Types
export interface FuelLog {
  id: string;
  vehicleId: string;
  date: string;
  liters: number;
  cost: number;
  odometer: number;
  station?: string;
  createdAt: string;
}

export interface OdometerLog {
  id: string;
  vehicleId: string;
  reading: number;
  source: 'manual' | 'fuel' | 'trip' | 'maintenance';
  notes?: string;
  recordedAt: string;
  createdAt: string;
}

// Maintenance Types
export type ServiceType = 'Oil Change' | 'Tire Replacement' | 'Brake Service' | 'Engine Repair' | 'Transmission' | 'Electrical' | 'Body Work' | 'General Service' | 'Other';
export type MaintenanceStatus = 'Scheduled' | 'In Progress' | 'Completed' | 'Overdue';

export interface Maintenance {
  id: string;
  vehicleId: string;
  serviceType: ServiceType;
  status: MaintenanceStatus;
  scheduledDate: string;
  completedDate?: string;
  cost: number;
  serviceProvider?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// Incident Types
export type IncidentSeverity = 'Minor' | 'Moderate' | 'Major';
export type IncidentStatus = 'Under Review' | 'In Repair' | 'Resolved';

export interface Incident {
  id: string;
  vehicleId: string;
  driverId?: string;
  title: string;
  date: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  location?: string;
  repairCost: number;
  finalRepairCost?: number;
  attachments?: string[];
  createdAt: string;
  updatedAt: string;
}

// Trip Types
export interface Trip {
  id: string;
  vehicleId: string;
  driverId: string;
  date: string;
  startLocation: string;
  destination: string;
  distance: number;
  purpose?: string;
  createdAt: string;
}

// Document Types
export type DocumentAudience = 'vehicle' | 'driver';
export type DocumentType = string;

export interface DocumentTypeOption {
  id: string;
  name: string;
  appliesTo: DocumentAudience | 'both';
  createdAt: string;
  isDefault?: boolean;
}

export interface Document {
  id: string;
  title: string;
  documentType: DocumentType;
  vehicleId?: string;
  driverId?: string;
  fileUrl: string;
  filePath?: string;
  fileName: string;
  fileSize: number;
  expiryDate?: string;
  uploadedAt: string;
  updatedAt: string;
}

// Notification Types
export type NotificationType = 'maintenance' | 'insurance' | 'license' | 'fuel' | 'incident' | 'general';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  vehicleId?: string;
  driverId?: string;
  createdAt: string;
}

export interface AppSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  maintenanceAlerts: boolean;
  fuelAlerts: boolean;
  incidentAlerts: boolean;
  documentAlerts: boolean;
  licenseAlerts: boolean;
  darkMode: boolean;
  compactView: boolean;
  currency: string;
  dateFormat: string;
  timeFormat: string;
  maintenanceReminderDays: string;
  fuelEfficiencyUnit: string;
}

// Dashboard Stats
export interface DashboardStats {
  totalVehicles: number;
  activeVehicles: number;
  idleVehicles: number;
  maintenanceVehicles: number;
  totalDrivers: number;
  activeDrivers: number;
  totalFuelCost: number;
  totalMaintenanceCost: number;
  monthlyFuelCost: number;
  monthlyMaintenanceCost: number;
  upcomingMaintenance: number;
  overdueMaintenance: number;
  unreadNotifications: number;
}

// Filter Types
export interface VehicleFilter {
  status?: VehicleStatus;
  vehicleType?: VehicleType;
  search?: string;
}

export interface DateRange {
  startDate?: string;
  endDate?: string;
}
