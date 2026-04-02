import { db } from '@/lib/db';
import { queueNotificationEmail } from '@/lib/email-notifications';
import { loadCurrentUserSettings } from '@/lib/settings-data';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Assignment, Driver, FuelLog, Incident, Maintenance, Notification, OdometerLog, Trip, Vehicle } from '@/types';

type VehicleRow = {
  id: string;
  plate_number: string;
  vehicle_type: Vehicle['vehicleType'];
  brand: string;
  model: string;
  year: number;
  vin: string | null;
  engine_number: string | null;
  purchase_date: string | null;
  purchase_cost: number | null;
  vendor: string | null;
  warranty_expiry: string | null;
  status: Vehicle['status'];
  current_odometer: number | null;
  next_service_due_odometer: number | null;
  current_driver_id: string | null;
  created_at: string;
  updated_at: string;
};

type DriverRow = {
  id: string;
  full_name: string;
  phone_number: string;
  email: string | null;
  license_number: string;
  license_expiry: string;
  date_of_birth: string | null;
  hire_date: string | null;
  address: string | null;
  status: Driver['status'];
  created_at: string;
  updated_at: string;
};

type AssignmentRow = {
  id: string;
  vehicle_id: string;
  driver_id: string;
  start_date: string;
  end_date: string | null;
  created_at: string;
};

type IncidentRow = {
  id: string;
  vehicle_id: string;
  driver_id: string | null;
  title: string;
  date: string;
  description: string;
  severity: Incident['severity'];
  status: Incident['status'];
  location: string | null;
  repair_cost: number;
  final_repair_cost: number | null;
  attachments: string[] | null;
  created_at: string;
  updated_at: string;
};

type TripRow = {
  id: string;
  vehicle_id: string;
  driver_id: string;
  date: string;
  start_location: string;
  destination: string;
  distance: number;
  purpose: string | null;
  created_at: string;
};

type MaintenanceRow = {
  id: string;
  vehicle_id: string;
  service_type: Maintenance['serviceType'];
  status: Maintenance['status'];
  scheduled_date: string;
  completed_date: string | null;
  cost: number;
  service_provider: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type FuelLogRow = {
  id: string;
  vehicle_id: string;
  date: string;
  liters: number;
  cost: number;
  odometer: number;
  station: string | null;
  created_at: string;
};

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  type: Notification['type'];
  is_read: boolean;
  vehicle_id: string | null;
  driver_id: string | null;
  created_at: string;
};

type OdometerLogRow = {
  id: string;
  vehicle_id: string;
  reading: number;
  source: OdometerLog['source'];
  notes: string | null;
  recorded_at: string;
  created_at: string;
};

const ACTIVE_MAINTENANCE_STATUSES: Maintenance['status'][] = ['In Progress', 'Overdue'];

function deriveVehicleStatusFromMaintenance(
  currentStatus: Vehicle['status'],
  maintenanceStatuses: Maintenance['status'][]
): Vehicle['status'] {
  const hasActiveMaintenance = maintenanceStatuses.some((status) =>
    ACTIVE_MAINTENANCE_STATUSES.includes(status)
  );

  if (hasActiveMaintenance) {
    return 'Under Maintenance';
  }

  if (currentStatus === 'Under Maintenance') {
    return 'Active';
  }

  return currentStatus;
}

function mapVehicleRow(row: VehicleRow): Vehicle {
  return {
    id: row.id,
    plateNumber: row.plate_number,
    vehicleType: row.vehicle_type,
    brand: row.brand,
    model: row.model,
    year: row.year,
    vin: row.vin || undefined,
    engineNumber: row.engine_number || undefined,
    purchaseDate: row.purchase_date || undefined,
    purchaseCost: row.purchase_cost ?? undefined,
    vendor: row.vendor || undefined,
    warrantyExpiry: row.warranty_expiry || undefined,
    status: row.status,
    currentOdometer: row.current_odometer ?? undefined,
    nextServiceDueOdometer: row.next_service_due_odometer ?? undefined,
    currentDriverId: row.current_driver_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDriverRow(row: DriverRow): Driver {
  return {
    id: row.id,
    fullName: row.full_name,
    phoneNumber: row.phone_number,
    email: row.email || undefined,
    licenseNumber: row.license_number,
    licenseExpiry: row.license_expiry,
    dateOfBirth: row.date_of_birth || undefined,
    hireDate: row.hire_date || undefined,
    address: row.address || undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAssignmentRow(row: AssignmentRow): Assignment {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    driverId: row.driver_id,
    startDate: row.start_date,
    endDate: row.end_date || undefined,
    createdAt: row.created_at,
  };
}

function mapIncidentRow(row: IncidentRow): Incident {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    driverId: row.driver_id || undefined,
    title: row.title,
    date: row.date,
    description: row.description,
    severity: row.severity,
    status: row.status,
    location: row.location || undefined,
    repairCost: row.repair_cost,
    finalRepairCost: row.final_repair_cost ?? undefined,
    attachments: row.attachments ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTripRow(row: TripRow): Trip {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    driverId: row.driver_id,
    date: row.date,
    startLocation: row.start_location,
    destination: row.destination,
    distance: row.distance,
    purpose: row.purpose || undefined,
    createdAt: row.created_at,
  };
}

function mapMaintenanceRow(row: MaintenanceRow): Maintenance {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    serviceType: row.service_type,
    status: row.status,
    scheduledDate: row.scheduled_date,
    completedDate: row.completed_date || undefined,
    cost: row.cost,
    serviceProvider: row.service_provider || undefined,
    description: row.description || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFuelLogRow(row: FuelLogRow): FuelLog {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    date: row.date,
    liters: row.liters,
    cost: row.cost,
    odometer: row.odometer,
    station: row.station || undefined,
    createdAt: row.created_at,
  };
}

function mapNotificationRow(row: NotificationRow): Notification {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    type: row.type,
    isRead: row.is_read,
    vehicleId: row.vehicle_id || undefined,
    driverId: row.driver_id || undefined,
    createdAt: row.created_at,
  };
}

function mapOdometerLogRow(row: OdometerLogRow): OdometerLog {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    reading: row.reading,
    source: row.source,
    notes: row.notes || undefined,
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
  };
}

function mapVehicleToRow(vehicle: Vehicle) {
  return {
    id: vehicle.id,
    plate_number: vehicle.plateNumber,
    vehicle_type: vehicle.vehicleType,
    brand: vehicle.brand,
    model: vehicle.model,
    year: vehicle.year,
    vin: vehicle.vin ?? null,
    engine_number: vehicle.engineNumber ?? null,
    purchase_date: vehicle.purchaseDate ?? null,
    purchase_cost: vehicle.purchaseCost ?? null,
    vendor: vehicle.vendor ?? null,
    warranty_expiry: vehicle.warrantyExpiry ?? null,
    status: vehicle.status,
    current_odometer: vehicle.currentOdometer ?? null,
    next_service_due_odometer: vehicle.nextServiceDueOdometer ?? null,
    current_driver_id: vehicle.currentDriverId ?? null,
  };
}

function mapDriverToRow(driver: Driver) {
  return {
    id: driver.id,
    full_name: driver.fullName,
    phone_number: driver.phoneNumber,
    email: driver.email ?? null,
    license_number: driver.licenseNumber,
    license_expiry: driver.licenseExpiry,
    date_of_birth: driver.dateOfBirth ?? null,
    hire_date: driver.hireDate ?? null,
    address: driver.address ?? null,
    status: driver.status,
  };
}

function mapAssignmentToRow(assignment: Assignment) {
  return {
    id: assignment.id,
    vehicle_id: assignment.vehicleId,
    driver_id: assignment.driverId,
    start_date: assignment.startDate,
    end_date: assignment.endDate ?? null,
  };
}

function mapIncidentToRow(incident: Incident) {
  return {
    id: incident.id,
    vehicle_id: incident.vehicleId,
    driver_id: incident.driverId ?? null,
    title: incident.title,
    date: incident.date,
    description: incident.description,
    severity: incident.severity,
    status: incident.status,
    location: incident.location ?? null,
    repair_cost: incident.repairCost,
    final_repair_cost: incident.finalRepairCost ?? null,
    attachments: incident.attachments ?? null,
  };
}

function mapTripToRow(trip: Trip) {
  return {
    id: trip.id,
    vehicle_id: trip.vehicleId,
    driver_id: trip.driverId,
    date: trip.date,
    start_location: trip.startLocation,
    destination: trip.destination,
    distance: trip.distance,
    purpose: trip.purpose ?? null,
  };
}

function mapMaintenanceToRow(maintenance: Maintenance) {
  return {
    id: maintenance.id,
    vehicle_id: maintenance.vehicleId,
    service_type: maintenance.serviceType,
    status: maintenance.status,
    scheduled_date: maintenance.scheduledDate,
    completed_date: maintenance.completedDate ?? null,
    cost: maintenance.cost,
    service_provider: maintenance.serviceProvider ?? null,
    description: maintenance.description ?? null,
  };
}

function mapFuelLogToRow(log: FuelLog) {
  return {
    id: log.id,
    vehicle_id: log.vehicleId,
    date: log.date,
    liters: log.liters,
    cost: log.cost,
    odometer: log.odometer,
    station: log.station ?? null,
  };
}

function mapNotificationToRow(notification: Notification) {
  return {
    id: notification.id,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    is_read: notification.isRead,
    vehicle_id: notification.vehicleId ?? null,
    driver_id: notification.driverId ?? null,
  };
}

function mapOdometerLogToRow(log: OdometerLog) {
  return {
    id: log.id,
    vehicle_id: log.vehicleId,
    reading: log.reading,
    source: log.source,
    notes: log.notes ?? null,
    recorded_at: log.recordedAt,
  };
}

async function withSupabaseRead<T>(fallback: () => T, action: () => Promise<T>): Promise<T> {
  if (!isSupabaseConfigured || !supabase) {
    return fallback();
  }

  try {
    return await action();
  } catch (error) {
    console.error('Supabase fleet data request failed.', error);
    throw error;
  }
}

async function withSupabaseWrite<T>(fallback: () => T, action: () => Promise<T>): Promise<T> {
  if (!isSupabaseConfigured || !supabase) {
    return fallback();
  }

  return action();
}

async function syncVehicleStatusFromMaintenance(vehicleId: string): Promise<void> {
  const nextStatus = await withSupabaseRead(
    () => {
      const vehicle = db.vehicles.getById(vehicleId);
      if (!vehicle) {
        return undefined;
      }

      const maintenanceRecords = db.maintenance.query((record) => record.vehicleId === vehicleId);
      const hasActiveMaintenance = maintenanceRecords.some((record) =>
        ACTIVE_MAINTENANCE_STATUSES.includes(record.status)
      );

      if (hasActiveMaintenance) {
        return 'Under Maintenance' as Vehicle['status'];
      }

      if (vehicle.status === 'Under Maintenance') {
        return 'Active' as Vehicle['status'];
      }

      return undefined;
    },
    async () => {
      const [{ data: vehicleData, error: vehicleError }, { data: maintenanceData, error: maintenanceError }] =
        await Promise.all([
          supabase!
            .from('vehicles')
            .select('status')
            .eq('id', vehicleId)
            .maybeSingle(),
          supabase!
            .from('maintenance')
            .select('status')
            .eq('vehicle_id', vehicleId),
        ]);

      if (vehicleError) throw vehicleError;
      if (maintenanceError) throw maintenanceError;
      if (!vehicleData) {
        return undefined;
      }

      const hasActiveMaintenance = (maintenanceData as Array<Pick<MaintenanceRow, 'status'>>).some((record) =>
        ACTIVE_MAINTENANCE_STATUSES.includes(record.status)
      );

      if (hasActiveMaintenance) {
        return 'Under Maintenance' as Vehicle['status'];
      }

      if ((vehicleData as Pick<VehicleRow, 'status'>).status === 'Under Maintenance') {
        return 'Active' as Vehicle['status'];
      }

      return undefined;
    }
  );

  if (!nextStatus) {
    return;
  }

  await withSupabaseWrite(
    () => {
      db.vehicles.update(vehicleId, {
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      });
    },
    async () => {
      const { error } = await supabase!
        .from('vehicles')
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', vehicleId);

      if (error) throw error;
    }
  );
}

export async function listVehicles(): Promise<Vehicle[]> {
  return withSupabaseRead(
    () => {
      const vehicles = db.vehicles.getAll();
      const maintenanceByVehicle = new Map<string, Maintenance['status'][]>();

      for (const record of db.maintenance.getAll()) {
        const statuses = maintenanceByVehicle.get(record.vehicleId) ?? [];
        statuses.push(record.status);
        maintenanceByVehicle.set(record.vehicleId, statuses);
      }

      return vehicles.map((vehicle) => ({
        ...vehicle,
        status: deriveVehicleStatusFromMaintenance(
          vehicle.status,
          maintenanceByVehicle.get(vehicle.id) ?? []
        ),
      }));
    },
    async () => {
      const [{ data: vehicleData, error: vehicleError }, { data: maintenanceData, error: maintenanceError }] =
        await Promise.all([
          supabase!
            .from('vehicles')
            .select('*')
            .order('created_at', { ascending: false }),
          supabase!
            .from('maintenance')
            .select('vehicle_id, status'),
        ]);

      if (vehicleError) throw vehicleError;
      if (maintenanceError) throw maintenanceError;

      const maintenanceByVehicle = new Map<string, Maintenance['status'][]>();

      for (const record of (maintenanceData ?? []) as Array<Pick<MaintenanceRow, 'vehicle_id' | 'status'>>) {
        const statuses = maintenanceByVehicle.get(record.vehicle_id) ?? [];
        statuses.push(record.status);
        maintenanceByVehicle.set(record.vehicle_id, statuses);
      }

      return (vehicleData as VehicleRow[]).map((row) => {
        const vehicle = mapVehicleRow(row);
        return {
          ...vehicle,
          status: deriveVehicleStatusFromMaintenance(
            vehicle.status,
            maintenanceByVehicle.get(vehicle.id) ?? []
          ),
        };
      });
    }
  );
}

export async function listDrivers(): Promise<Driver[]> {
  return withSupabaseRead(
    () => db.drivers.getAll(),
    async () => {
      const { data, error } = await supabase!
        .from('drivers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as DriverRow[]).map(mapDriverRow);
    }
  );
}

export async function listVehiclesAndDrivers(): Promise<{ vehicles: Vehicle[]; drivers: Driver[] }> {
  const [vehicles, drivers] = await Promise.all([listVehicles(), listDrivers()]);
  return { vehicles, drivers };
}

export async function listOperationalVehicles(): Promise<Vehicle[]> {
  const vehicles = await listVehicles();
  return vehicles.filter((vehicle) => vehicle.status !== 'Decommissioned');
}

export async function listOperationalVehiclesAndActiveDrivers(): Promise<{ vehicles: Vehicle[]; drivers: Driver[] }> {
  const [vehicles, drivers] = await Promise.all([listOperationalVehicles(), listActiveDrivers()]);
  return { vehicles, drivers };
}

export async function listIncidents(): Promise<Incident[]> {
  return withSupabaseRead(
    () => db.incidents.getAll(),
    async () => {
      const { data, error } = await supabase!
        .from('incidents')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      return (data as IncidentRow[]).map(mapIncidentRow);
    }
  );
}

export async function listIncidentsByVehicle(vehicleId: string): Promise<Incident[]> {
  return withSupabaseRead(
    () => db.incidents.query((incident) => incident.vehicleId === vehicleId),
    async () => {
      const { data, error } = await supabase!
        .from('incidents')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('date', { ascending: false });

      if (error) throw error;
      return (data as IncidentRow[]).map(mapIncidentRow);
    }
  );
}

export async function listIncidentsByDriver(driverId: string): Promise<Incident[]> {
  return withSupabaseRead(
    () => db.incidents.query((incident) => incident.driverId === driverId),
    async () => {
      const { data, error } = await supabase!
        .from('incidents')
        .select('*')
        .eq('driver_id', driverId)
        .order('date', { ascending: false });

      if (error) throw error;
      return (data as IncidentRow[]).map(mapIncidentRow);
    }
  );
}

export async function listTrips(): Promise<Trip[]> {
  return withSupabaseRead(
    () => db.trips.getAll(),
    async () => {
      const { data, error } = await supabase!
        .from('trips')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      return (data as TripRow[]).map(mapTripRow);
    }
  );
}

export async function listTripsByVehicle(vehicleId: string): Promise<Trip[]> {
  return withSupabaseRead(
    () => db.trips.query((trip) => trip.vehicleId === vehicleId),
    async () => {
      const { data, error } = await supabase!
        .from('trips')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('date', { ascending: false });

      if (error) throw error;
      return (data as TripRow[]).map(mapTripRow);
    }
  );
}

export async function listTripsByDriver(driverId: string): Promise<Trip[]> {
  return withSupabaseRead(
    () => db.trips.query((trip) => trip.driverId === driverId),
    async () => {
      const { data, error } = await supabase!
        .from('trips')
        .select('*')
        .eq('driver_id', driverId)
        .order('date', { ascending: false });

      if (error) throw error;
      return (data as TripRow[]).map(mapTripRow);
    }
  );
}

export async function listMaintenance(): Promise<Maintenance[]> {
  return withSupabaseRead(
    () => db.maintenance.getAll(),
    async () => {
      const { data, error } = await supabase!
        .from('maintenance')
        .select('*')
        .order('scheduled_date', { ascending: false });

      if (error) throw error;
      return (data as MaintenanceRow[]).map(mapMaintenanceRow);
    }
  );
}

export async function listMaintenanceByVehicle(vehicleId: string): Promise<Maintenance[]> {
  return withSupabaseRead(
    () => db.maintenance.query((record) => record.vehicleId === vehicleId),
    async () => {
      const { data, error } = await supabase!
        .from('maintenance')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('scheduled_date', { ascending: false });

      if (error) throw error;
      return (data as MaintenanceRow[]).map(mapMaintenanceRow);
    }
  );
}

export async function listFuelLogs(): Promise<FuelLog[]> {
  return withSupabaseRead(
    () => db.fuelLogs.getAll(),
    async () => {
      const { data, error } = await supabase!
        .from('fuel_logs')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      return (data as FuelLogRow[]).map(mapFuelLogRow);
    }
  );
}

export async function listFuelLogsByVehicle(vehicleId: string): Promise<FuelLog[]> {
  return withSupabaseRead(
    () => db.fuelLogs.query((log) => log.vehicleId === vehicleId),
    async () => {
      const { data, error } = await supabase!
        .from('fuel_logs')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('date', { ascending: false });

      if (error) throw error;
      return (data as FuelLogRow[]).map(mapFuelLogRow);
    }
  );
}

export async function listNotifications(): Promise<Notification[]> {
  return withSupabaseRead(
    () => db.notifications.getAll(),
    async () => {
      const { data, error } = await supabase!
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as NotificationRow[]).map(mapNotificationRow);
    }
  );
}

export async function listOdometerLogsByVehicle(vehicleId: string): Promise<OdometerLog[]> {
  return withSupabaseRead(
    () => [],
    async () => {
      const { data, error } = await supabase!
        .from('vehicle_odometer_logs')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('recorded_at', { ascending: false });

      if (error) throw error;
      return (data as OdometerLogRow[]).map(mapOdometerLogRow);
    }
  );
}

export async function getVehicleById(id: string): Promise<Vehicle | undefined> {
  return withSupabaseRead(
    () => {
      const vehicle = db.vehicles.getById(id);
      if (!vehicle) {
        return undefined;
      }

      const maintenanceStatuses = db.maintenance
        .query((record) => record.vehicleId === id)
        .map((record) => record.status);

      return {
        ...vehicle,
        status: deriveVehicleStatusFromMaintenance(vehicle.status, maintenanceStatuses),
      };
    },
    async () => {
      const [{ data: vehicleData, error: vehicleError }, { data: maintenanceData, error: maintenanceError }] =
        await Promise.all([
          supabase!.from('vehicles').select('*').eq('id', id).maybeSingle(),
          supabase!.from('maintenance').select('status').eq('vehicle_id', id),
        ]);

      if (vehicleError) throw vehicleError;
      if (maintenanceError) throw maintenanceError;
      if (!vehicleData) return undefined;

      const vehicle = mapVehicleRow(vehicleData as VehicleRow);
      const maintenanceStatuses = ((maintenanceData ?? []) as Array<Pick<MaintenanceRow, 'status'>>).map(
        (record) => record.status
      );

      return {
        ...vehicle,
        status: deriveVehicleStatusFromMaintenance(vehicle.status, maintenanceStatuses),
      };
    }
  );
}

export async function getDriverById(id: string): Promise<Driver | undefined> {
  return withSupabaseRead(
    () => db.drivers.getById(id),
    async () => {
      const { data, error } = await supabase!.from('drivers').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data ? mapDriverRow(data as DriverRow) : undefined;
    }
  );
}

export async function listActiveDrivers(): Promise<Driver[]> {
  return withSupabaseRead(
    () => db.drivers.query((driver) => driver.status === 'Active'),
    async () => {
      const { data, error } = await supabase!
        .from('drivers')
        .select('*')
        .eq('status', 'Active')
        .order('full_name', { ascending: true });

      if (error) throw error;
      return (data as DriverRow[]).map(mapDriverRow);
    }
  );
}

export async function getAssignedVehicleForDriver(driverId: string): Promise<Vehicle | undefined> {
  return withSupabaseRead(
    () =>
      db.vehicles
        .query((vehicle) => vehicle.currentDriverId === driverId)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0],
    async () => {
      const { data, error } = await supabase!
        .from('vehicles')
        .select('*')
        .eq('current_driver_id', driverId)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      return data && data.length > 0 ? mapVehicleRow(data[0] as VehicleRow) : undefined;
    }
  );
}

export async function listAssignmentsByDriver(driverId: string): Promise<Assignment[]> {
  return withSupabaseRead(
    () => db.assignments.query((assignment) => assignment.driverId === driverId),
    async () => {
      const { data, error } = await supabase!
        .from('assignments')
        .select('*')
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as AssignmentRow[]).map(mapAssignmentRow);
    }
  );
}

export async function updateVehicleCurrentDriver(
  vehicleId: string,
  currentDriverId: string | undefined
): Promise<void> {
  return withSupabaseWrite(
    () => {
      db.vehicles.update(vehicleId, { currentDriverId });
    },
    async () => {
      const { error } = await supabase!
        .from('vehicles')
        .update({ current_driver_id: currentDriverId ?? null })
        .eq('id', vehicleId);

      if (error) throw error;
    }
  );
}

export async function updateDriverStatus(
  driverId: string,
  status: Driver['status']
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const updatedAt = new Date().toISOString();

  return withSupabaseWrite(
    () => {
      db.drivers.update(driverId, { status, updatedAt });

      if (status === 'Inactive') {
        for (const vehicle of db.vehicles.query((item) => item.currentDriverId === driverId)) {
          db.vehicles.update(vehicle.id, { currentDriverId: undefined, updatedAt });
        }

        for (const assignment of db.assignments.query((item) => item.driverId === driverId && !item.endDate)) {
          db.assignments.update(assignment.id, { endDate: today });
        }
      }
    },
    async () => {
      const { error: driverError } = await supabase!
        .from('drivers')
        .update({ status, updated_at: updatedAt })
        .eq('id', driverId);

      if (driverError) throw driverError;

      if (status === 'Inactive') {
        const { error: vehicleError } = await supabase!
          .from('vehicles')
          .update({ current_driver_id: null, updated_at: updatedAt })
          .eq('current_driver_id', driverId);

        if (vehicleError) throw vehicleError;

        const { error: assignmentError } = await supabase!
          .from('assignments')
          .update({ end_date: today })
          .eq('driver_id', driverId)
          .is('end_date', null);

        if (assignmentError) throw assignmentError;
      }
    }
  );
}

export async function updateVehicleStatus(
  vehicleId: string,
  status: Vehicle['status']
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const updatedAt = new Date().toISOString();
  const shouldClearAssignment = status === 'Decommissioned';

  return withSupabaseWrite(
    () => {
      db.vehicles.update(vehicleId, {
        status,
        currentDriverId: shouldClearAssignment ? undefined : db.vehicles.getById(vehicleId)?.currentDriverId,
        updatedAt,
      });

      if (shouldClearAssignment) {
        for (const assignment of db.assignments.query((item) => item.vehicleId === vehicleId && !item.endDate)) {
          db.assignments.update(assignment.id, { endDate: today });
        }
      }
    },
    async () => {
      const payload: {
        status: Vehicle['status'];
        updated_at: string;
        current_driver_id?: string | null;
      } = {
        status,
        updated_at: updatedAt,
      };

      if (shouldClearAssignment) {
        payload.current_driver_id = null;
      }

      const { error: vehicleError } = await supabase!
        .from('vehicles')
        .update(payload)
        .eq('id', vehicleId);

      if (vehicleError) throw vehicleError;

      if (shouldClearAssignment) {
        const { error: assignmentError } = await supabase!
          .from('assignments')
          .update({ end_date: today })
          .eq('vehicle_id', vehicleId)
          .is('end_date', null);

        if (assignmentError) throw assignmentError;
      }
    }
  );
}

async function setVehicleCurrentOdometer(vehicleId: string, reading: number): Promise<void> {
  return withSupabaseWrite(
    () => {
      db.vehicles.update(vehicleId, { currentOdometer: reading });
    },
    async () => {
      const { error } = await supabase!
        .from('vehicles')
        .update({ current_odometer: reading })
        .eq('id', vehicleId);

      if (error) throw error;
    }
  );
}

export async function updateVehicleServiceDueOdometer(
  vehicleId: string,
  nextServiceDueOdometer: number | undefined
): Promise<void> {
  return withSupabaseWrite(
    () => {
      db.vehicles.update(vehicleId, { nextServiceDueOdometer });
    },
    async () => {
      const { error } = await supabase!
        .from('vehicles')
        .update({ next_service_due_odometer: nextServiceDueOdometer ?? null })
        .eq('id', vehicleId);

      if (error) throw error;
    }
  );
}

export async function createAssignment(assignment: Assignment): Promise<Assignment> {
  return withSupabaseWrite(
    () => db.assignments.create(assignment),
    async () => {
      const { data, error } = await supabase!
        .from('assignments')
        .insert(mapAssignmentToRow(assignment))
        .select()
        .single();

      if (error) throw error;
      return mapAssignmentRow(data as AssignmentRow);
    }
  );
}

export async function assignDriverToVehicle(vehicleId: string, driverId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  return withSupabaseWrite(
    () => {
      const currentVehiclesForDriver = db.vehicles.query(
        (vehicle) => vehicle.currentDriverId === driverId && vehicle.id !== vehicleId
      );
      currentVehiclesForDriver.forEach((vehicle) => {
        db.vehicles.update(vehicle.id, { currentDriverId: undefined });
      });

      const activeAssignmentsForDriver = db.assignments.query(
        (assignment) => assignment.driverId === driverId && !assignment.endDate
      );
      activeAssignmentsForDriver.forEach((assignment) => {
        db.assignments.update(assignment.id, { endDate: today });
      });

      const activeAssignmentsForVehicle = db.assignments.query(
        (assignment) => assignment.vehicleId === vehicleId && !assignment.endDate
      );
      activeAssignmentsForVehicle.forEach((assignment) => {
        db.assignments.update(assignment.id, { endDate: today });
      });

      db.vehicles.update(vehicleId, { currentDriverId: driverId });
      db.assignments.create({
        id: `asg-${Date.now()}`,
        vehicleId,
        driverId,
        startDate: today,
        createdAt: new Date().toISOString(),
      });
    },
    async () => {
      const { data: existingDriverVehicles, error: driverVehiclesError } = await supabase!
        .from('vehicles')
        .select('id')
        .eq('current_driver_id', driverId)
        .neq('id', vehicleId);

      if (driverVehiclesError) throw driverVehiclesError;

      if (existingDriverVehicles && existingDriverVehicles.length > 0) {
        const vehicleIds = existingDriverVehicles.map((vehicle) => vehicle.id);

        const { error: clearDriverVehiclesError } = await supabase!
          .from('vehicles')
          .update({ current_driver_id: null })
          .in('id', vehicleIds);

        if (clearDriverVehiclesError) throw clearDriverVehiclesError;
      }

      const { error: closeDriverAssignmentsError } = await supabase!
        .from('assignments')
        .update({ end_date: today })
        .eq('driver_id', driverId)
        .is('end_date', null);

      if (closeDriverAssignmentsError) throw closeDriverAssignmentsError;

      const { error: closeVehicleAssignmentsError } = await supabase!
        .from('assignments')
        .update({ end_date: today })
        .eq('vehicle_id', vehicleId)
        .is('end_date', null);

      if (closeVehicleAssignmentsError) throw closeVehicleAssignmentsError;

      const { error: setVehicleDriverError } = await supabase!
        .from('vehicles')
        .update({ current_driver_id: driverId })
        .eq('id', vehicleId);

      if (setVehicleDriverError) throw setVehicleDriverError;

      const { error: createAssignmentError } = await supabase!.from('assignments').insert({
        id: `asg-${Date.now()}`,
        vehicle_id: vehicleId,
        driver_id: driverId,
        start_date: today,
      });

      if (createAssignmentError) throw createAssignmentError;
    }
  );
}

export async function createVehicle(vehicle: Vehicle): Promise<Vehicle> {
  return withSupabaseWrite(
    () => db.vehicles.create(vehicle),
    async () => {
      const { data, error } = await supabase!
        .from('vehicles')
        .insert(mapVehicleToRow(vehicle))
        .select()
        .single();

      if (error) throw error;
      return mapVehicleRow(data as VehicleRow);
    }
  );
}

export async function createDriver(driver: Driver): Promise<Driver> {
  return withSupabaseWrite(
    () => db.drivers.create(driver),
    async () => {
      const { data, error } = await supabase!
        .from('drivers')
        .insert(mapDriverToRow(driver))
        .select()
        .single();

      if (error) throw error;
      return mapDriverRow(data as DriverRow);
    }
  );
}

export async function createIncident(incident: Incident): Promise<Incident> {
  const createdIncident = await withSupabaseWrite(
    () => db.incidents.create(incident),
    async () => {
      const { data, error } = await supabase!
        .from('incidents')
        .insert(mapIncidentToRow(incident))
        .select()
        .single();

      if (error) throw error;
      return mapIncidentRow(data as IncidentRow);
    }
  );

  try {
    const settings = await loadCurrentUserSettings();
    if (!settings.incidentAlerts) {
      return createdIncident;
    }

    const vehicle = await getVehicleById(createdIncident.vehicleId);
    await upsertNotification({
      id: `auto-incident-${createdIncident.id}`,
      title: 'New Incident Reported',
      message: vehicle
        ? `${createdIncident.title} was reported for ${vehicle.brand} ${vehicle.model} (${vehicle.plateNumber}).`
        : `${createdIncident.title} was reported.`,
      type: 'incident',
      isRead: false,
      vehicleId: createdIncident.vehicleId,
      driverId: createdIncident.driverId,
      createdAt: new Date().toISOString(),
    });
    await queueNotificationEmail(`auto-incident-${createdIncident.id}`);
  } catch (error) {
    console.error('Failed to create incident notification', error);
  }

  return createdIncident;
}

export async function createTrip(trip: Trip): Promise<Trip> {
  return withSupabaseWrite(
    () => db.trips.create(trip),
    async () => {
      const { data, error } = await supabase!
        .from('trips')
        .insert(mapTripToRow(trip))
        .select()
        .single();

      if (error) throw error;
      return mapTripRow(data as TripRow);
    }
  );
}

export async function createMaintenance(maintenance: Maintenance): Promise<Maintenance> {
  const createdMaintenance = await withSupabaseWrite(
    () => db.maintenance.create(maintenance),
    async () => {
      const { data, error } = await supabase!
        .from('maintenance')
        .insert(mapMaintenanceToRow(maintenance))
        .select()
        .single();

      if (error) throw error;
      return mapMaintenanceRow(data as MaintenanceRow);
    }
  );

  await syncVehicleStatusFromMaintenance(createdMaintenance.vehicleId);
  return createdMaintenance;
}

export async function createFuelLog(log: FuelLog): Promise<FuelLog> {
  const createdLog = await withSupabaseWrite(
    () => db.fuelLogs.create(log),
    async () => {
      const { data, error } = await supabase!
        .from('fuel_logs')
        .insert(mapFuelLogToRow(log))
        .select()
        .single();

      if (error) throw error;
      return mapFuelLogRow(data as FuelLogRow);
    }
  );

  await recordVehicleOdometer({
    vehicleId: createdLog.vehicleId,
    reading: createdLog.odometer,
    source: 'fuel',
    recordedAt: createdLog.date,
    notes: createdLog.station ? `Fuel purchase at ${createdLog.station}` : 'Fuel purchase',
  });

  return createdLog;
}

export async function createNotification(notification: Notification): Promise<Notification> {
  return withSupabaseWrite(
    () => db.notifications.create(notification),
    async () => {
      const { data, error } = await supabase!
        .from('notifications')
        .insert(mapNotificationToRow(notification))
        .select()
        .single();

      if (error) throw error;
      return mapNotificationRow(data as NotificationRow);
    }
  );
}

export async function upsertNotification(notification: Notification): Promise<Notification> {
  return withSupabaseWrite(
    () => {
      const existing = db.notifications.getById(notification.id);
      if (existing) {
        return db.notifications.update(notification.id, notification) ?? notification;
      }
      return db.notifications.create(notification);
    },
    async () => {
      const { data, error } = await supabase!
        .from('notifications')
        .upsert(mapNotificationToRow(notification), { onConflict: 'id' })
        .select()
        .single();

      if (error) throw error;
      return mapNotificationRow(data as NotificationRow);
    }
  );
}

export async function deleteVehicle(id: string): Promise<void> {
  void id;
  throw new Error('Vehicle deletion is disabled. Use status changes instead.');
}

export async function deleteDriver(id: string): Promise<void> {
  void id;
  throw new Error('Driver deletion is disabled. Mark the driver inactive instead.');
}

export async function updateIncident(
  id: string,
  updates: Partial<Pick<Incident, 'status' | 'finalRepairCost'>>
): Promise<Incident | undefined> {
  return withSupabaseWrite(
    () => db.incidents.update(id, updates),
    async () => {
      const payload: Record<string, string | number | null> = {};
      if (updates.status !== undefined) {
        payload.status = updates.status;
      }
      if (updates.finalRepairCost !== undefined) {
        payload.final_repair_cost = updates.finalRepairCost ?? null;
      }

      const { data, error } = await supabase!
        .from('incidents')
        .update(payload)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) throw error;
      return data ? mapIncidentRow(data as IncidentRow) : undefined;
    }
  );
}

export async function updateMaintenance(
  id: string,
  updates: Partial<Pick<Maintenance, 'status' | 'completedDate'>>
): Promise<Maintenance | undefined> {
  const updatedMaintenance = await withSupabaseWrite(
    () => db.maintenance.update(id, updates),
    async () => {
      const payload: Record<string, string | null> = {};

      if (updates.status !== undefined) {
        payload.status = updates.status;
      }
      if (updates.completedDate !== undefined) {
        payload.completed_date = updates.completedDate ?? null;
      }

      const { data, error } = await supabase!
        .from('maintenance')
        .update(payload)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) throw error;
      return data ? mapMaintenanceRow(data as MaintenanceRow) : undefined;
    }
  );

  if (updatedMaintenance) {
    await syncVehicleStatusFromMaintenance(updatedMaintenance.vehicleId);
  }

  return updatedMaintenance;
}

export async function updateNotification(
  id: string,
  updates: Partial<Pick<Notification, 'isRead'>>
): Promise<Notification | undefined> {
  return withSupabaseWrite(
    () => db.notifications.update(id, updates),
    async () => {
      const payload: Record<string, boolean> = {};

      if (updates.isRead !== undefined) {
        payload.is_read = updates.isRead;
      }

      const { data, error } = await supabase!
        .from('notifications')
        .update(payload)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) throw error;
      return data ? mapNotificationRow(data as NotificationRow) : undefined;
    }
  );
}

export async function deleteNotification(id: string): Promise<void> {
  void id;
  throw new Error('Notification deletion is disabled. Mark notifications as read instead.');
}

export async function recordVehicleOdometer(input: {
  vehicleId: string;
  reading: number;
  source: OdometerLog['source'];
  recordedAt?: string;
  notes?: string;
}): Promise<OdometerLog> {
  const vehicle = await getVehicleById(input.vehicleId);
  if (!vehicle) {
    throw new Error('Vehicle not found');
  }

  const currentReading = vehicle.currentOdometer ?? 0;
  if (input.reading < currentReading) {
    throw new Error(`Odometer reading cannot be lower than the current reading of ${currentReading} km`);
  }

  const log: OdometerLog = {
    id: `odo-${Date.now()}`,
    vehicleId: input.vehicleId,
    reading: input.reading,
    source: input.source,
    notes: input.notes,
    recordedAt: input.recordedAt ?? new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  await withSupabaseWrite(
    () => log,
    async () => {
      const { error } = await supabase!
        .from('vehicle_odometer_logs')
        .insert(mapOdometerLogToRow(log));

      if (error) throw error;
      return log;
    }
  );

  await setVehicleCurrentOdometer(input.vehicleId, input.reading);
  return log;
}

export async function findVehicleByPlateNumber(plateNumber: string): Promise<Vehicle | undefined> {
  return withSupabaseRead(
    () => db.vehicles.query((vehicle) => vehicle.plateNumber === plateNumber)[0],
    async () => {
      const { data, error } = await supabase!
        .from('vehicles')
        .select('*')
        .eq('plate_number', plateNumber)
        .maybeSingle();

      if (error) throw error;
      return data ? mapVehicleRow(data as VehicleRow) : undefined;
    }
  );
}
