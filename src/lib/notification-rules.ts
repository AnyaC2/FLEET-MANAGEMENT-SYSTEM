import type { Document, Notification } from '@/types';
import { listDocuments } from '@/lib/documents-data';
import { queueNotificationEmail } from '@/lib/email-notifications';
import { loadCurrentUserSettings } from '@/lib/settings-data';
import {
  deleteNotification,
  listDrivers,
  listMaintenance,
  listNotifications,
  listVehicles,
  upsertNotification,
} from '@/lib/fleet-data';

const LICENSE_ALERT_DAYS = 30;
const DOCUMENT_ALERT_DAYS = 30;
const MAINTENANCE_ODOMETER_ALERT_KM = 500;
const RULE_PREFIXES = ['auto-license-', 'auto-document-', 'auto-maintenance-'];

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysUntil(dateString: string) {
  const target = startOfDay(new Date(dateString));
  const today = startOfDay(new Date());
  return Math.floor((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getDocumentNotificationType(document: Document): Notification['type'] {
  if (document.documentType === 'Insurance') {
    return 'insurance';
  }
  if (document.documentType === 'License') {
    return 'license';
  }
  return 'general';
}

function isRuleNotification(id: string) {
  return RULE_PREFIXES.some((prefix) => id.startsWith(prefix));
}

export async function syncAutomaticNotifications(): Promise<void> {
  const [settings, notifications, drivers, vehicles, maintenanceRecords, documents] = await Promise.all([
    loadCurrentUserSettings(),
    listNotifications(),
    listDrivers(),
    listVehicles(),
    listMaintenance(),
    listDocuments(),
  ]);

  const existingById = new Map(notifications.map((notification) => [notification.id, notification]));
  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const desiredRuleNotifications = new Map<string, Notification>();

  for (const driver of drivers) {
    if (!settings.licenseAlerts) {
      break;
    }

    const remainingDays = daysUntil(driver.licenseExpiry);
    if (remainingDays > LICENSE_ALERT_DAYS) {
      continue;
    }

    const isExpired = remainingDays < 0;
    const id = `auto-license-${driver.id}`;
    const existing = existingById.get(id);
    desiredRuleNotifications.set(id, {
      id,
      title: isExpired ? 'License Expired' : 'License Expiring Soon',
      message: isExpired
        ? `${driver.fullName}'s driver license expired on ${new Date(driver.licenseExpiry).toLocaleDateString()}.`
        : `${driver.fullName}'s driver license expires on ${new Date(driver.licenseExpiry).toLocaleDateString()}.`,
      type: 'license',
      isRead: existing?.isRead ?? false,
      driverId: driver.id,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    });
  }

  for (const document of documents) {
    if (!settings.documentAlerts) {
      break;
    }

    if (!document.expiryDate) {
      continue;
    }

    const remainingDays = daysUntil(document.expiryDate);
    if (remainingDays > DOCUMENT_ALERT_DAYS) {
      continue;
    }

    const isExpired = remainingDays < 0;
    const id = `auto-document-${document.id}`;
    const existing = existingById.get(id);
    desiredRuleNotifications.set(id, {
      id,
      title: isExpired ? `${document.documentType} Expired` : `${document.documentType} Expiring Soon`,
      message: isExpired
        ? `${document.title} expired on ${new Date(document.expiryDate).toLocaleDateString()}.`
        : `${document.title} expires on ${new Date(document.expiryDate).toLocaleDateString()}.`,
      type: getDocumentNotificationType(document),
      isRead: existing?.isRead ?? false,
      vehicleId: document.vehicleId,
      driverId: document.driverId,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    });
  }

  for (const record of maintenanceRecords) {
    if (!settings.maintenanceAlerts) {
      break;
    }

    if (record.status === 'Completed') {
      continue;
    }

    const maintenanceAlertDays = Number.parseInt(settings.maintenanceReminderDays, 10) || 7;
    const remainingDays = daysUntil(record.scheduledDate);
    const isOverdue = remainingDays < 0 || record.status === 'Overdue';
    const isDueSoon = remainingDays >= 0 && remainingDays <= maintenanceAlertDays;

    if (!isOverdue && !isDueSoon) {
      continue;
    }

    const vehicle = vehicleById.get(record.vehicleId);
    const id = `auto-maintenance-${record.id}`;
    const existing = existingById.get(id);
    desiredRuleNotifications.set(id, {
      id,
      title: isOverdue ? 'Maintenance Overdue' : 'Maintenance Due Soon',
      message: vehicle
        ? `${vehicle.brand} ${vehicle.model} (${vehicle.plateNumber}) has ${isOverdue ? 'overdue' : 'scheduled'} maintenance on ${new Date(record.scheduledDate).toLocaleDateString()}.`
        : `A vehicle has ${isOverdue ? 'overdue' : 'scheduled'} maintenance on ${new Date(record.scheduledDate).toLocaleDateString()}.`,
      type: 'maintenance',
      isRead: existing?.isRead ?? false,
      vehicleId: record.vehicleId,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    });
  }

  for (const vehicle of vehicles) {
    if (!settings.maintenanceAlerts) {
      break;
    }

    if (
      vehicle.currentOdometer === undefined ||
      vehicle.nextServiceDueOdometer === undefined
    ) {
      continue;
    }

    const remainingKm = vehicle.nextServiceDueOdometer - vehicle.currentOdometer;
    const isOverdue = remainingKm <= 0;
    const isDueSoon = remainingKm > 0 && remainingKm <= MAINTENANCE_ODOMETER_ALERT_KM;

    if (!isOverdue && !isDueSoon) {
      continue;
    }

    const id = `auto-maintenance-odometer-${vehicle.id}`;
    const existing = existingById.get(id);
    desiredRuleNotifications.set(id, {
      id,
      title: isOverdue ? 'Maintenance Mileage Overdue' : 'Maintenance Mileage Due Soon',
      message: isOverdue
        ? `${vehicle.brand} ${vehicle.model} (${vehicle.plateNumber}) is overdue for service at ${vehicle.nextServiceDueOdometer.toLocaleString()} km. Current reading: ${vehicle.currentOdometer.toLocaleString()} km.`
        : `${vehicle.brand} ${vehicle.model} (${vehicle.plateNumber}) is due for service in ${remainingKm.toLocaleString()} km at ${vehicle.nextServiceDueOdometer.toLocaleString()} km.`,
      type: 'maintenance',
      isRead: existing?.isRead ?? false,
      vehicleId: vehicle.id,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    });
  }

  for (const notification of desiredRuleNotifications.values()) {
    await upsertNotification(notification);
    if (!existingById.has(notification.id)) {
      await queueNotificationEmail(notification.id);
    }
  }

  const staleRuleNotifications = notifications.filter(
    (notification) => isRuleNotification(notification.id) && !desiredRuleNotifications.has(notification.id)
  );

  for (const notification of staleRuleNotifications) {
    await deleteNotification(notification.id);
  }
}
