import * as XLSX from 'xlsx';
import type {
  Assignment,
  Driver,
  FuelLog,
  Incident,
  Maintenance,
  Trip,
  Vehicle,
  VehicleStatus,
  VehicleType,
} from '@/types';
import { exportWorkbook, safeDateLabel } from '@/lib/excel-export';
import {
  createAssignment,
  createDriver,
  createFuelLog,
  createIncident,
  createMaintenance,
  createTrip,
  createVehicle,
  listAssignments,
  listDrivers,
  listFuelLogs,
  listIncidents,
  listMaintenance,
  listTrips,
  listVehicles,
  updateVehicleCurrentDriver,
} from '@/lib/fleet-data';

export type ImportSheetKey =
  | 'vehicles'
  | 'drivers'
  | 'assignments'
  | 'fuelLogs'
  | 'maintenance'
  | 'incidents'
  | 'trips';

export type ImportIssueSeverity = 'error' | 'warning';

export interface ImportIssue {
  sheet: string;
  row: number;
  severity: ImportIssueSeverity;
  message: string;
}

export interface ImportSheetPreview {
  key: ImportSheetKey;
  label: string;
  detectedSheetName: string;
  headers: string[];
  sourceRows: number;
  validRows: number;
}

export interface ImportUnmatchedSheetPreview {
  sheetName: string;
  sourceRows: number;
  headers: string[];
  suggestedKey?: ImportSheetKey;
}

interface VehicleImportRow {
  sourceRow: number;
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
}

interface DriverImportRow {
  sourceRow: number;
  fullName: string;
  phoneNumber: string;
  email?: string;
  licenseNumber: string;
  licenseExpiry: string;
  dateOfBirth?: string;
  hireDate?: string;
  address?: string;
  status: Driver['status'];
}

interface AssignmentImportRow {
  sourceRow: number;
  vehiclePlateNumber: string;
  driverLicenseNumber: string;
  startDate: string;
  endDate?: string;
}

interface FuelLogImportRow {
  sourceRow: number;
  vehiclePlateNumber: string;
  date: string;
  liters: number;
  cost: number;
  odometer: number;
  station?: string;
}

interface MaintenanceImportRow {
  sourceRow: number;
  vehiclePlateNumber: string;
  serviceType: Maintenance['serviceType'];
  status: Maintenance['status'];
  scheduledDate: string;
  completedDate?: string;
  cost: number;
  serviceProvider?: string;
  description?: string;
}

interface IncidentImportRow {
  sourceRow: number;
  vehiclePlateNumber: string;
  driverLicenseNumber?: string;
  title: string;
  date: string;
  description: string;
  severity: Incident['severity'];
  status: Incident['status'];
  location?: string;
  repairCost: number;
  finalRepairCost?: number;
}

interface TripImportRow {
  sourceRow: number;
  vehiclePlateNumber: string;
  driverLicenseNumber: string;
  date: string;
  startLocation: string;
  destination: string;
  distance: number;
  purpose?: string;
}

export interface ImportPayload {
  vehicles: VehicleImportRow[];
  drivers: DriverImportRow[];
  assignments: AssignmentImportRow[];
  fuelLogs: FuelLogImportRow[];
  maintenance: MaintenanceImportRow[];
  incidents: IncidentImportRow[];
  trips: TripImportRow[];
}

export interface ImportWorkbookPreview {
  fileName: string;
  sheets: ImportSheetPreview[];
  unmatchedSheets: ImportUnmatchedSheetPreview[];
  issues: ImportIssue[];
  totalRows: number;
  validRows: number;
  canImport: boolean;
  payload: ImportPayload;
}

export interface ParseImportWorkbookOptions {
  sheetOverrides?: Partial<Record<string, ImportSheetKey | 'ignore'>>;
  columnOverrides?: Partial<Record<string, Record<string, string>>>;
}

export interface ImportExecutionResult {
  created: Record<ImportSheetKey, number>;
  skipped: Record<ImportSheetKey, number>;
  issues: ImportIssue[];
}

const vehicleTypes: VehicleType[] = [
  'Truck',
  'Bus',
  'SUV',
  'Sedan',
  'Van',
  'Pickup',
  'Motorcycle',
  'Other',
];

const vehicleStatuses: VehicleStatus[] = ['Active', 'Idle', 'Under Maintenance', 'Decommissioned'];
const driverStatuses: Driver['status'][] = ['Active', 'Inactive'];
const maintenanceStatuses: Maintenance['status'][] = ['Scheduled', 'In Progress', 'Completed', 'Overdue'];
const serviceTypes: Maintenance['serviceType'][] = [
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
const incidentSeverities: Incident['severity'][] = ['Minor', 'Moderate', 'Major'];
const incidentStatuses: Incident['status'][] = ['Under Review', 'In Repair', 'Resolved'];

const sheetAliases: Record<ImportSheetKey, string[]> = {
  vehicles: ['vehicles', 'vehicle', 'vehicle list', 'fleet', 'fleet register', 'asset register'],
  drivers: ['drivers', 'driver', 'driver list', 'driver register', 'staff drivers'],
  assignments: ['assignments', 'assignment', 'allocations', 'vehicle assignments', 'driver assignments'],
  fuelLogs: ['fuellogs', 'fuel logs', 'fuel_log', 'fuel log', 'fuel', 'fuel purchases', 'fuel register'],
  maintenance: ['maintenance', 'maintenancerecords', 'maintenance records', 'service', 'service log', 'workshop'],
  incidents: ['incidents', 'incident', 'accidents', 'incident register'],
  trips: ['trips', 'trip', 'journeys', 'trip log', 'travel log'],
};

const sheetLabels: Record<ImportSheetKey, string> = {
  vehicles: 'Vehicles',
  drivers: 'Drivers',
  assignments: 'Assignments',
  fuelLogs: 'Fuel Logs',
  maintenance: 'Maintenance',
  incidents: 'Incidents',
  trips: 'Trips',
};

export const importSheetOptions = (Object.keys(sheetLabels) as ImportSheetKey[]).map((key) => ({
  value: key,
  label: sheetLabels[key],
}));

export interface ImportSheetFieldDefinition {
  key: string;
  label: string;
  required?: boolean;
}

const emptyPayload = (): ImportPayload => ({
  vehicles: [],
  drivers: [],
  assignments: [],
  fuelLogs: [],
  maintenance: [],
  incidents: [],
  trips: [],
});

const emptyCountRecord = (): Record<ImportSheetKey, number> => ({
  vehicles: 0,
  drivers: 0,
  assignments: 0,
  fuelLogs: 0,
  maintenance: 0,
  incidents: 0,
  trips: 0,
});

const vehicleFieldAliases = {
  plateNumber: [
    'Plate Number',
    'Plate',
    'Plate No',
    'Vehicle Plate Number',
    'Vehicle Plate',
    'Registration Number',
    'Registration No',
    'Reg Number',
    'Reg No',
  ],
  vehicleType: ['Vehicle Type', 'Type', 'Category'],
  brand: ['Brand', 'Make', 'Manufacturer'],
  model: ['Model', 'Variant'],
  year: ['Year', 'Model Year'],
  vin: ['VIN', 'Chassis Number', 'Chassis No'],
  engineNumber: ['Engine Number', 'Engine No'],
  purchaseDate: ['Purchase Date', 'Acquisition Date', 'Date Purchased'],
  purchaseCost: ['Purchase Cost', 'Acquisition Cost', 'Vehicle Cost'],
  vendor: ['Vendor', 'Supplier', 'Dealer'],
  warrantyExpiry: ['Warranty Expiry', 'Warranty Expiration', 'Warranty End Date'],
  status: ['Status'],
  currentOdometer: ['Current Odometer', 'Current Odometer (km)', 'Odometer', 'Mileage', 'Mileage (km)'],
  nextServiceDueOdometer: [
    'Next Service Due Odometer',
    'Next Service Due Odometer (km)',
    'Service Due Odometer',
    'Next Service Mileage',
    'Next Service Due Mileage',
  ],
} as const;

const driverFieldAliases = {
  fullName: ['Full Name', 'Name', 'Driver Name'],
  phoneNumber: ['Phone Number', 'Phone', 'Mobile', 'Telephone'],
  email: ['Email', 'Email Address'],
  licenseNumber: [
    'License Number',
    'Driver License Number',
    'Licence Number',
    'Driver Licence Number',
    'License No',
    'Licence No',
  ],
  licenseExpiry: ['License Expiry', 'Licence Expiry', 'License Expiration', 'Licence Expiration'],
  dateOfBirth: ['Date of Birth', 'DOB', 'Birth Date'],
  hireDate: ['Hire Date', 'Employment Date', 'Date Hired'],
  address: ['Address', 'Home Address', 'Residential Address'],
  status: ['Status'],
} as const;

const assignmentFieldAliases = {
  vehiclePlateNumber: [...vehicleFieldAliases.plateNumber, 'Assigned Vehicle Plate', 'Vehicle Registration Number'],
  driverLicenseNumber: [...driverFieldAliases.licenseNumber, 'Assigned Driver License Number'],
  startDate: ['Start Date', 'Assignment Start Date', 'Allocation Start Date'],
  endDate: ['End Date', 'Assignment End Date', 'Allocation End Date'],
} as const;

const fuelLogFieldAliases = {
  vehiclePlateNumber: [...vehicleFieldAliases.plateNumber, 'Vehicle Registration Number'],
  date: ['Date', 'Fuel Date', 'Transaction Date'],
  liters: ['Liters', 'Litres', 'Volume', 'Quantity'],
  cost: ['Cost', 'Amount', 'Fuel Cost'],
  odometer: ['Odometer', 'Current Odometer', 'Mileage'],
  station: ['Station', 'Fuel Station', 'Station Name'],
} as const;

const maintenanceFieldAliases = {
  vehiclePlateNumber: [...vehicleFieldAliases.plateNumber, 'Vehicle Registration Number'],
  serviceType: ['Service Type', 'Maintenance Type', 'Work Type'],
  status: ['Status'],
  scheduledDate: ['Scheduled Date', 'Service Date', 'Planned Date'],
  completedDate: ['Completed Date', 'Completion Date', 'Date Completed'],
  cost: ['Cost', 'Maintenance Cost', 'Service Cost'],
  serviceProvider: ['Service Provider', 'Provider', 'Workshop', 'Garage'],
  description: ['Description', 'Notes', 'Details'],
} as const;

const incidentFieldAliases = {
  vehiclePlateNumber: [...vehicleFieldAliases.plateNumber, 'Vehicle Registration Number'],
  driverLicenseNumber: [...driverFieldAliases.licenseNumber],
  title: ['Title', 'Incident Title', 'Subject'],
  date: ['Date', 'Incident Date'],
  description: ['Description', 'Incident Description', 'Details'],
  severity: ['Severity', 'Impact'],
  status: ['Status'],
  location: ['Location', 'Incident Location'],
  repairCost: ['Repair Cost', 'Estimated Repair Cost', 'Cost Estimate'],
  finalRepairCost: ['Final Repair Cost', 'Actual Repair Cost', 'Final Cost'],
} as const;

const tripFieldAliases = {
  vehiclePlateNumber: [...vehicleFieldAliases.plateNumber, 'Vehicle Registration Number'],
  driverLicenseNumber: [...driverFieldAliases.licenseNumber],
  date: ['Date', 'Trip Date', 'Travel Date'],
  startLocation: ['Start Location', 'Origin', 'From'],
  destination: ['Destination', 'End Location', 'To'],
  distance: ['Distance', 'Trip Distance', 'Distance (km)'],
  purpose: ['Purpose', 'Reason', 'Trip Purpose'],
} as const;

const sheetInferenceHeaders: Record<ImportSheetKey, readonly (readonly string[])[]> = {
  vehicles: [
    vehicleFieldAliases.plateNumber,
    vehicleFieldAliases.vehicleType,
    vehicleFieldAliases.brand,
    vehicleFieldAliases.model,
  ],
  drivers: [
    driverFieldAliases.fullName,
    driverFieldAliases.phoneNumber,
    driverFieldAliases.licenseNumber,
    driverFieldAliases.licenseExpiry,
  ],
  assignments: [
    assignmentFieldAliases.vehiclePlateNumber,
    assignmentFieldAliases.driverLicenseNumber,
    assignmentFieldAliases.startDate,
  ],
  fuelLogs: [
    fuelLogFieldAliases.vehiclePlateNumber,
    fuelLogFieldAliases.liters,
    fuelLogFieldAliases.cost,
    fuelLogFieldAliases.odometer,
  ],
  maintenance: [
    maintenanceFieldAliases.vehiclePlateNumber,
    maintenanceFieldAliases.serviceType,
    maintenanceFieldAliases.scheduledDate,
    maintenanceFieldAliases.serviceProvider,
  ],
  incidents: [
    incidentFieldAliases.vehiclePlateNumber,
    incidentFieldAliases.title,
    incidentFieldAliases.severity,
    incidentFieldAliases.repairCost,
  ],
  trips: [
    tripFieldAliases.vehiclePlateNumber,
    tripFieldAliases.driverLicenseNumber,
    tripFieldAliases.startLocation,
    tripFieldAliases.destination,
    tripFieldAliases.distance,
  ],
};

export const importSheetFieldDefinitions: Record<ImportSheetKey, readonly ImportSheetFieldDefinition[]> = {
  vehicles: [
    { key: 'plateNumber', label: 'Plate Number', required: true },
    { key: 'vehicleType', label: 'Vehicle Type', required: true },
    { key: 'brand', label: 'Brand', required: true },
    { key: 'model', label: 'Model', required: true },
    { key: 'year', label: 'Year', required: true },
    { key: 'vin', label: 'VIN' },
    { key: 'engineNumber', label: 'Engine Number' },
    { key: 'purchaseDate', label: 'Purchase Date' },
    { key: 'purchaseCost', label: 'Purchase Cost' },
    { key: 'vendor', label: 'Vendor' },
    { key: 'warrantyExpiry', label: 'Warranty Expiry' },
    { key: 'status', label: 'Status' },
    { key: 'currentOdometer', label: 'Current Odometer' },
    { key: 'nextServiceDueOdometer', label: 'Next Service Due Odometer' },
  ],
  drivers: [
    { key: 'fullName', label: 'Full Name', required: true },
    { key: 'phoneNumber', label: 'Phone Number', required: true },
    { key: 'email', label: 'Email' },
    { key: 'licenseNumber', label: 'License Number', required: true },
    { key: 'licenseExpiry', label: 'License Expiry', required: true },
    { key: 'dateOfBirth', label: 'Date of Birth' },
    { key: 'hireDate', label: 'Hire Date' },
    { key: 'address', label: 'Address' },
    { key: 'status', label: 'Status' },
  ],
  assignments: [
    { key: 'vehiclePlateNumber', label: 'Vehicle Plate Number', required: true },
    { key: 'driverLicenseNumber', label: 'Driver License Number', required: true },
    { key: 'startDate', label: 'Start Date', required: true },
    { key: 'endDate', label: 'End Date' },
  ],
  fuelLogs: [
    { key: 'vehiclePlateNumber', label: 'Vehicle Plate Number', required: true },
    { key: 'date', label: 'Date', required: true },
    { key: 'liters', label: 'Liters', required: true },
    { key: 'cost', label: 'Cost', required: true },
    { key: 'odometer', label: 'Odometer', required: true },
    { key: 'station', label: 'Station' },
  ],
  maintenance: [
    { key: 'vehiclePlateNumber', label: 'Vehicle Plate Number', required: true },
    { key: 'serviceType', label: 'Service Type', required: true },
    { key: 'status', label: 'Status' },
    { key: 'scheduledDate', label: 'Scheduled Date', required: true },
    { key: 'completedDate', label: 'Completed Date' },
    { key: 'cost', label: 'Cost' },
    { key: 'serviceProvider', label: 'Service Provider' },
    { key: 'description', label: 'Description' },
  ],
  incidents: [
    { key: 'vehiclePlateNumber', label: 'Vehicle Plate Number', required: true },
    { key: 'driverLicenseNumber', label: 'Driver License Number' },
    { key: 'title', label: 'Title', required: true },
    { key: 'date', label: 'Date', required: true },
    { key: 'description', label: 'Description', required: true },
    { key: 'severity', label: 'Severity' },
    { key: 'status', label: 'Status' },
    { key: 'location', label: 'Location' },
    { key: 'repairCost', label: 'Repair Cost' },
    { key: 'finalRepairCost', label: 'Final Repair Cost' },
  ],
  trips: [
    { key: 'vehiclePlateNumber', label: 'Vehicle Plate Number', required: true },
    { key: 'driverLicenseNumber', label: 'Driver License Number', required: true },
    { key: 'date', label: 'Date', required: true },
    { key: 'startLocation', label: 'Start Location', required: true },
    { key: 'destination', label: 'Destination', required: true },
    { key: 'distance', label: 'Distance', required: true },
    { key: 'purpose', label: 'Purpose' },
  ],
};

const importSheetFieldAliasMap: Record<ImportSheetKey, Record<string, readonly string[]>> = {
  vehicles: vehicleFieldAliases,
  drivers: driverFieldAliases,
  assignments: assignmentFieldAliases,
  fuelLogs: fuelLogFieldAliases,
  maintenance: maintenanceFieldAliases,
  incidents: incidentFieldAliases,
  trips: tripFieldAliases,
};

function normalizeSheetName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeLookup(value: string) {
  return value.trim().toLowerCase();
}

function tokenizeValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function scoreHeaderMatch(header: string, alias: string) {
  const normalizedHeader = normalizeHeader(header);
  const normalizedAlias = normalizeHeader(alias);

  if (!normalizedHeader || !normalizedAlias) {
    return 0;
  }

  if (normalizedHeader === normalizedAlias) {
    return 100;
  }

  if (
    normalizedHeader.length > 4 &&
    normalizedAlias.length > 4 &&
    (normalizedHeader.includes(normalizedAlias) || normalizedAlias.includes(normalizedHeader))
  ) {
    return 75;
  }

  const headerTokens = new Set(tokenizeValue(header));
  const aliasTokens = tokenizeValue(alias);
  if (headerTokens.size === 0 || aliasTokens.length === 0) {
    return 0;
  }

  const matchingTokenCount = aliasTokens.filter((token) => headerTokens.has(token)).length;
  if (matchingTokenCount === 0) {
    return 0;
  }

  return Math.round((matchingTokenCount / aliasTokens.length) * 60);
}

export function getImportFieldSuggestions(sheetKey: ImportSheetKey, headers: string[]) {
  const suggestions: Record<string, string | undefined> = {};
  const fieldAliases = importSheetFieldAliasMap[sheetKey];

  for (const field of importSheetFieldDefinitions[sheetKey]) {
    const aliases = fieldAliases[field.key] ?? [];
    let bestHeader: string | undefined;
    let bestScore = 0;

    for (const header of headers) {
      for (const alias of aliases) {
        const score = scoreHeaderMatch(header, alias);
        if (score > bestScore) {
          bestHeader = header;
          bestScore = score;
        }
      }
    }

    suggestions[field.key] = bestScore >= 45 ? bestHeader : undefined;
  }

  return suggestions;
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function issue(sheet: string, row: number, severity: ImportIssueSeverity, message: string): ImportIssue {
  return { sheet, row, severity, message };
}

function getSheetKey(sheetName: string): ImportSheetKey | null {
  const normalized = normalizeSheetName(sheetName);
  const directMatch = (Object.keys(sheetAliases) as ImportSheetKey[]).find((key) =>
    sheetAliases[key].includes(normalized)
  );

  return directMatch ?? null;
}

function getHeaderSet(rows: Array<Record<string, string>>) {
  const headers = new Set<string>();

  for (const row of rows.slice(0, 10)) {
    for (const key of Object.keys(row)) {
      if (key) {
        headers.add(key);
      }
    }
  }

  return headers;
}

function countHeaderMatches(headers: Set<string>, aliasGroups: readonly (readonly string[])[]) {
  let matches = 0;

  for (const aliases of aliasGroups) {
    if (aliases.some((alias) => headers.has(normalizeHeader(alias)))) {
      matches += 1;
    }
  }

  return matches;
}

function getRankedSheetMatches(rows: Array<Record<string, string>>) {
  const headers = getHeaderSet(rows);
  return (Object.keys(sheetInferenceHeaders) as ImportSheetKey[])
    .map((key) => ({
      key,
      score: countHeaderMatches(headers, sheetInferenceHeaders[key]),
    }))
    .sort((left, right) => right.score - left.score);
}

function inferSheetKey(rows: Array<Record<string, string>>): ImportSheetKey | null {
  if (rows.length === 0) {
    return null;
  }

  const ranked = getRankedSheetMatches(rows);

  const best = ranked[0];
  const second = ranked[1];

  if (!best || best.score < 2) {
    return null;
  }

  if (second && best.score === second.score) {
    return null;
  }

  return best.key;
}

function suggestSheetKey(rows: Array<Record<string, string>>): ImportSheetKey | undefined {
  if (rows.length === 0) {
    return undefined;
  }

  const best = getRankedSheetMatches(rows)[0];
  if (!best || best.score === 0) {
    return undefined;
  }

  return best.key;
}

function resolveSheetKey(
  sheetName: string,
  rows: Array<Record<string, string>>
): { key: ImportSheetKey; inferred: boolean } | null {
  const directMatch = getSheetKey(sheetName);
  if (directMatch) {
    return { key: directMatch, inferred: false };
  }

  const inferred = inferSheetKey(rows);
  if (!inferred) {
    return null;
  }

  return { key: inferred, inferred: true };
}

function getNormalizedRows(worksheet: XLSX.WorkSheet): Array<Record<string, string>> {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: '',
    raw: false,
    dateNF: 'yyyy-mm-dd',
  });

  return rows.map((row) => {
    const normalizedRow: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      normalizedRow[normalizeHeader(key)] = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
    }
    return normalizedRow;
  });
}

function getWorksheetHeaders(worksheet: XLSX.WorkSheet) {
  const [headerRow] = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    raw: false,
    defval: '',
  });

  if (!Array.isArray(headerRow)) {
    return [];
  }

  return headerRow
    .map((value) => (typeof value === 'string' ? value.trim() : String(value ?? '').trim()))
    .filter(Boolean);
}

function getFieldValue(
  row: Record<string, string>,
  aliases: readonly string[],
  fieldKey: string,
  columnOverrides?: Record<string, string>
) {
  const overrideHeader = columnOverrides?.[fieldKey];
  if (overrideHeader) {
    const value = row[normalizeHeader(overrideHeader)];
    return value ? value.trim() : '';
  }

  return getValue(row, [...aliases]);
}

function getValue(row: Record<string, string>, aliases: string[]) {
  for (const alias of aliases) {
    const value = row[normalizeHeader(alias)];
    if (value) {
      return value.trim();
    }
  }
  return '';
}

function parseDateValue(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString().split('T')[0];
}

function parseNumberValue(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const normalized = trimmed.replace(/,/g, '').replace(/[^0-9.-]/g, '');
  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseEnumValue<T extends string>(value: string, allowed: readonly T[]): T | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const match = allowed.find((option) => option.toLowerCase() === trimmed.toLowerCase());
  return match;
}

function addRequiredTextIssue(
  sheet: string,
  rowNumber: number,
  fieldLabel: string,
  value: string,
  issues: ImportIssue[]
) {
  if (!value.trim()) {
    issues.push(issue(sheet, rowNumber, 'error', `${fieldLabel} is required.`));
    return false;
  }

  return true;
}

function addInvalidIssue(
  sheet: string,
  rowNumber: number,
  fieldLabel: string,
  issues: ImportIssue[],
  expected?: string
) {
  issues.push(
    issue(
      sheet,
      rowNumber,
      'error',
      expected ? `${fieldLabel} is invalid. Expected ${expected}.` : `${fieldLabel} is invalid.`
    )
  );
}

function parseVehicles(
  rows: Array<Record<string, string>>,
  sheet: string,
  issues: ImportIssue[],
  columnOverrides?: Record<string, string>
) {
  const parsed: VehicleImportRow[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const plateNumber = getFieldValue(row, vehicleFieldAliases.plateNumber, 'plateNumber', columnOverrides);
    const vehicleType = parseEnumValue(
      getFieldValue(row, vehicleFieldAliases.vehicleType, 'vehicleType', columnOverrides),
      vehicleTypes
    );
    const brand = getFieldValue(row, vehicleFieldAliases.brand, 'brand', columnOverrides);
    const model = getFieldValue(row, vehicleFieldAliases.model, 'model', columnOverrides);
    const year = parseNumberValue(getFieldValue(row, vehicleFieldAliases.year, 'year', columnOverrides));
    const status =
      parseEnumValue(getFieldValue(row, vehicleFieldAliases.status, 'status', columnOverrides), vehicleStatuses) ??
      ('Active' as VehicleStatus);
    const purchaseDate = parseDateValue(
      getFieldValue(row, vehicleFieldAliases.purchaseDate, 'purchaseDate', columnOverrides)
    );
    const warrantyExpiry = parseDateValue(
      getFieldValue(row, vehicleFieldAliases.warrantyExpiry, 'warrantyExpiry', columnOverrides)
    );
    const purchaseCost = parseNumberValue(
      getFieldValue(row, vehicleFieldAliases.purchaseCost, 'purchaseCost', columnOverrides)
    );
    const currentOdometer = parseNumberValue(
      getFieldValue(row, vehicleFieldAliases.currentOdometer, 'currentOdometer', columnOverrides)
    );
    const nextServiceDueOdometer = parseNumberValue(
      getFieldValue(
        row,
        vehicleFieldAliases.nextServiceDueOdometer,
        'nextServiceDueOdometer',
        columnOverrides
      )
    );

    const rowIssuesBefore = issues.length;
    addRequiredTextIssue(sheet, rowNumber, 'Plate Number', plateNumber, issues);
    if (!vehicleType) addInvalidIssue(sheet, rowNumber, 'Vehicle Type', issues, vehicleTypes.join(', '));
    addRequiredTextIssue(sheet, rowNumber, 'Brand', brand, issues);
    addRequiredTextIssue(sheet, rowNumber, 'Model', model, issues);
    if (year === undefined || !Number.isInteger(year)) {
      addInvalidIssue(sheet, rowNumber, 'Year', issues, 'a whole number year');
    }
    if (getFieldValue(row, vehicleFieldAliases.purchaseDate, 'purchaseDate', columnOverrides) && !purchaseDate) {
      addInvalidIssue(sheet, rowNumber, 'Purchase Date', issues, 'a valid date');
    }
    if (
      getFieldValue(row, vehicleFieldAliases.warrantyExpiry, 'warrantyExpiry', columnOverrides) &&
      !warrantyExpiry
    ) {
      addInvalidIssue(sheet, rowNumber, 'Warranty Expiry', issues, 'a valid date');
    }
    if (
      getFieldValue(row, vehicleFieldAliases.purchaseCost, 'purchaseCost', columnOverrides) &&
      purchaseCost === undefined
    ) {
      addInvalidIssue(sheet, rowNumber, 'Purchase Cost', issues, 'a number');
    }
    if (
      getFieldValue(row, vehicleFieldAliases.currentOdometer, 'currentOdometer', columnOverrides) &&
      currentOdometer === undefined
    ) {
      addInvalidIssue(sheet, rowNumber, 'Current Odometer', issues, 'a number');
    }
    if (
      getFieldValue(
        row,
        vehicleFieldAliases.nextServiceDueOdometer,
        'nextServiceDueOdometer',
        columnOverrides
      ) &&
      nextServiceDueOdometer === undefined
    ) {
      addInvalidIssue(sheet, rowNumber, 'Next Service Due Odometer', issues, 'a number');
    }

    if (issues.length > rowIssuesBefore) {
      return;
    }

    parsed.push({
      sourceRow: rowNumber,
      plateNumber,
      vehicleType: vehicleType!,
      brand,
      model,
      year: year!,
      vin: getFieldValue(row, vehicleFieldAliases.vin, 'vin', columnOverrides) || undefined,
      engineNumber: getFieldValue(row, vehicleFieldAliases.engineNumber, 'engineNumber', columnOverrides) || undefined,
      purchaseDate,
      purchaseCost,
      vendor: getFieldValue(row, vehicleFieldAliases.vendor, 'vendor', columnOverrides) || undefined,
      warrantyExpiry,
      status,
      currentOdometer,
      nextServiceDueOdometer,
    });
  });

  return parsed;
}

function parseDrivers(
  rows: Array<Record<string, string>>,
  sheet: string,
  issues: ImportIssue[],
  columnOverrides?: Record<string, string>
) {
  const parsed: DriverImportRow[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const fullName = getFieldValue(row, driverFieldAliases.fullName, 'fullName', columnOverrides);
    const phoneNumber = getFieldValue(row, driverFieldAliases.phoneNumber, 'phoneNumber', columnOverrides);
    const licenseNumber = getFieldValue(row, driverFieldAliases.licenseNumber, 'licenseNumber', columnOverrides);
    const licenseExpiry = parseDateValue(
      getFieldValue(row, driverFieldAliases.licenseExpiry, 'licenseExpiry', columnOverrides)
    );
    const dateOfBirth = parseDateValue(
      getFieldValue(row, driverFieldAliases.dateOfBirth, 'dateOfBirth', columnOverrides)
    );
    const hireDate = parseDateValue(getFieldValue(row, driverFieldAliases.hireDate, 'hireDate', columnOverrides));
    const status =
      parseEnumValue(getFieldValue(row, driverFieldAliases.status, 'status', columnOverrides), driverStatuses) ??
      ('Active' as Driver['status']);

    const rowIssuesBefore = issues.length;
    addRequiredTextIssue(sheet, rowNumber, 'Full Name', fullName, issues);
    addRequiredTextIssue(sheet, rowNumber, 'Phone Number', phoneNumber, issues);
    addRequiredTextIssue(sheet, rowNumber, 'License Number', licenseNumber, issues);
    if (!licenseExpiry) {
      addInvalidIssue(sheet, rowNumber, 'License Expiry', issues, 'a valid date');
    }
    if (getFieldValue(row, driverFieldAliases.dateOfBirth, 'dateOfBirth', columnOverrides) && !dateOfBirth) {
      addInvalidIssue(sheet, rowNumber, 'Date of Birth', issues, 'a valid date');
    }
    if (getFieldValue(row, driverFieldAliases.hireDate, 'hireDate', columnOverrides) && !hireDate) {
      addInvalidIssue(sheet, rowNumber, 'Hire Date', issues, 'a valid date');
    }

    if (issues.length > rowIssuesBefore) {
      return;
    }

    parsed.push({
      sourceRow: rowNumber,
      fullName,
      phoneNumber,
      email: getFieldValue(row, driverFieldAliases.email, 'email', columnOverrides) || undefined,
      licenseNumber,
      licenseExpiry: licenseExpiry!,
      dateOfBirth,
      hireDate,
      address: getFieldValue(row, driverFieldAliases.address, 'address', columnOverrides) || undefined,
      status,
    });
  });

  return parsed;
}

function parseAssignments(
  rows: Array<Record<string, string>>,
  sheet: string,
  issues: ImportIssue[],
  columnOverrides?: Record<string, string>
) {
  const parsed: AssignmentImportRow[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const vehiclePlateNumber = getFieldValue(
      row,
      assignmentFieldAliases.vehiclePlateNumber,
      'vehiclePlateNumber',
      columnOverrides
    );
    const driverLicenseNumber = getFieldValue(
      row,
      assignmentFieldAliases.driverLicenseNumber,
      'driverLicenseNumber',
      columnOverrides
    );
    const startDate = parseDateValue(getFieldValue(row, assignmentFieldAliases.startDate, 'startDate', columnOverrides));
    const endDate = parseDateValue(getFieldValue(row, assignmentFieldAliases.endDate, 'endDate', columnOverrides));

    const rowIssuesBefore = issues.length;
    addRequiredTextIssue(sheet, rowNumber, 'Vehicle Plate Number', vehiclePlateNumber, issues);
    addRequiredTextIssue(sheet, rowNumber, 'Driver License Number', driverLicenseNumber, issues);
    if (!startDate) {
      addInvalidIssue(sheet, rowNumber, 'Start Date', issues, 'a valid date');
    }
    if (getFieldValue(row, assignmentFieldAliases.endDate, 'endDate', columnOverrides) && !endDate) {
      addInvalidIssue(sheet, rowNumber, 'End Date', issues, 'a valid date');
    }

    if (issues.length > rowIssuesBefore) {
      return;
    }

    parsed.push({
      sourceRow: rowNumber,
      vehiclePlateNumber,
      driverLicenseNumber,
      startDate: startDate!,
      endDate,
    });
  });

  return parsed;
}

function parseFuelLogs(
  rows: Array<Record<string, string>>,
  sheet: string,
  issues: ImportIssue[],
  columnOverrides?: Record<string, string>
) {
  const parsed: FuelLogImportRow[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const vehiclePlateNumber = getFieldValue(
      row,
      fuelLogFieldAliases.vehiclePlateNumber,
      'vehiclePlateNumber',
      columnOverrides
    );
    const date = parseDateValue(getFieldValue(row, fuelLogFieldAliases.date, 'date', columnOverrides));
    const liters = parseNumberValue(getFieldValue(row, fuelLogFieldAliases.liters, 'liters', columnOverrides));
    const cost = parseNumberValue(getFieldValue(row, fuelLogFieldAliases.cost, 'cost', columnOverrides));
    const odometer = parseNumberValue(getFieldValue(row, fuelLogFieldAliases.odometer, 'odometer', columnOverrides));

    const rowIssuesBefore = issues.length;
    addRequiredTextIssue(sheet, rowNumber, 'Vehicle Plate Number', vehiclePlateNumber, issues);
    if (!date) addInvalidIssue(sheet, rowNumber, 'Date', issues, 'a valid date');
    if (liters === undefined) addInvalidIssue(sheet, rowNumber, 'Liters', issues, 'a number');
    if (cost === undefined) addInvalidIssue(sheet, rowNumber, 'Cost', issues, 'a number');
    if (odometer === undefined) addInvalidIssue(sheet, rowNumber, 'Odometer', issues, 'a number');

    if (issues.length > rowIssuesBefore) {
      return;
    }

    parsed.push({
      sourceRow: rowNumber,
      vehiclePlateNumber,
      date: date!,
      liters: liters!,
      cost: cost!,
      odometer: odometer!,
      station: getFieldValue(row, fuelLogFieldAliases.station, 'station', columnOverrides) || undefined,
    });
  });

  return parsed;
}

function parseMaintenance(
  rows: Array<Record<string, string>>,
  sheet: string,
  issues: ImportIssue[],
  columnOverrides?: Record<string, string>
) {
  const parsed: MaintenanceImportRow[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const vehiclePlateNumber = getFieldValue(
      row,
      maintenanceFieldAliases.vehiclePlateNumber,
      'vehiclePlateNumber',
      columnOverrides
    );
    const serviceType =
      parseEnumValue(
        getFieldValue(row, maintenanceFieldAliases.serviceType, 'serviceType', columnOverrides),
        serviceTypes
      ) ??
      ('Other' as Maintenance['serviceType']);
    const status =
      parseEnumValue(getFieldValue(row, maintenanceFieldAliases.status, 'status', columnOverrides), maintenanceStatuses) ??
      ('Scheduled' as Maintenance['status']);
    const scheduledDate = parseDateValue(
      getFieldValue(row, maintenanceFieldAliases.scheduledDate, 'scheduledDate', columnOverrides)
    );
    const completedDate = parseDateValue(
      getFieldValue(row, maintenanceFieldAliases.completedDate, 'completedDate', columnOverrides)
    );
    const cost =
      parseNumberValue(getFieldValue(row, maintenanceFieldAliases.cost, 'cost', columnOverrides)) ?? 0;

    const rowIssuesBefore = issues.length;
    addRequiredTextIssue(sheet, rowNumber, 'Vehicle Plate Number', vehiclePlateNumber, issues);
    if (!serviceType) addInvalidIssue(sheet, rowNumber, 'Service Type', issues, serviceTypes.join(', '));
    if (!scheduledDate) addInvalidIssue(sheet, rowNumber, 'Scheduled Date', issues, 'a valid date');
    if (getFieldValue(row, maintenanceFieldAliases.completedDate, 'completedDate', columnOverrides) && !completedDate) {
      addInvalidIssue(sheet, rowNumber, 'Completed Date', issues, 'a valid date');
    }
    if (
      getFieldValue(row, maintenanceFieldAliases.cost, 'cost', columnOverrides) &&
      parseNumberValue(getFieldValue(row, maintenanceFieldAliases.cost, 'cost', columnOverrides)) === undefined
    ) {
      addInvalidIssue(sheet, rowNumber, 'Cost', issues, 'a number');
    }

    if (issues.length > rowIssuesBefore) {
      return;
    }

    parsed.push({
      sourceRow: rowNumber,
      vehiclePlateNumber,
      serviceType,
      status,
      scheduledDate: scheduledDate!,
      completedDate,
      cost,
      serviceProvider:
        getFieldValue(row, maintenanceFieldAliases.serviceProvider, 'serviceProvider', columnOverrides) ||
        undefined,
      description:
        getFieldValue(row, maintenanceFieldAliases.description, 'description', columnOverrides) || undefined,
    });
  });

  return parsed;
}

function parseIncidents(
  rows: Array<Record<string, string>>,
  sheet: string,
  issues: ImportIssue[],
  columnOverrides?: Record<string, string>
) {
  const parsed: IncidentImportRow[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const vehiclePlateNumber = getFieldValue(
      row,
      incidentFieldAliases.vehiclePlateNumber,
      'vehiclePlateNumber',
      columnOverrides
    );
    const driverLicenseNumber =
      getFieldValue(row, incidentFieldAliases.driverLicenseNumber, 'driverLicenseNumber', columnOverrides) ||
      undefined;
    const title = getFieldValue(row, incidentFieldAliases.title, 'title', columnOverrides);
    const date = parseDateValue(getFieldValue(row, incidentFieldAliases.date, 'date', columnOverrides));
    const description = getFieldValue(row, incidentFieldAliases.description, 'description', columnOverrides);
    const severity =
      parseEnumValue(getFieldValue(row, incidentFieldAliases.severity, 'severity', columnOverrides), incidentSeverities) ??
      ('Minor' as Incident['severity']);
    const status =
      parseEnumValue(getFieldValue(row, incidentFieldAliases.status, 'status', columnOverrides), incidentStatuses) ??
      ('Under Review' as Incident['status']);
    const repairCost =
      parseNumberValue(getFieldValue(row, incidentFieldAliases.repairCost, 'repairCost', columnOverrides)) ?? 0;
    const finalRepairCost = parseNumberValue(
      getFieldValue(row, incidentFieldAliases.finalRepairCost, 'finalRepairCost', columnOverrides)
    );

    const rowIssuesBefore = issues.length;
    addRequiredTextIssue(sheet, rowNumber, 'Vehicle Plate Number', vehiclePlateNumber, issues);
    addRequiredTextIssue(sheet, rowNumber, 'Title', title, issues);
    if (!date) addInvalidIssue(sheet, rowNumber, 'Date', issues, 'a valid date');
    addRequiredTextIssue(sheet, rowNumber, 'Description', description, issues);
    if (
      getFieldValue(row, incidentFieldAliases.repairCost, 'repairCost', columnOverrides) &&
      parseNumberValue(getFieldValue(row, incidentFieldAliases.repairCost, 'repairCost', columnOverrides)) ===
        undefined
    ) {
      addInvalidIssue(sheet, rowNumber, 'Repair Cost', issues, 'a number');
    }
    if (
      getFieldValue(row, incidentFieldAliases.finalRepairCost, 'finalRepairCost', columnOverrides) &&
      parseNumberValue(
        getFieldValue(row, incidentFieldAliases.finalRepairCost, 'finalRepairCost', columnOverrides)
      ) === undefined
    ) {
      addInvalidIssue(sheet, rowNumber, 'Final Repair Cost', issues, 'a number');
    }

    if (issues.length > rowIssuesBefore) {
      return;
    }

    parsed.push({
      sourceRow: rowNumber,
      vehiclePlateNumber,
      driverLicenseNumber,
      title,
      date: date!,
      description,
      severity,
      status,
      location: getFieldValue(row, incidentFieldAliases.location, 'location', columnOverrides) || undefined,
      repairCost,
      finalRepairCost,
    });
  });

  return parsed;
}

function parseTrips(
  rows: Array<Record<string, string>>,
  sheet: string,
  issues: ImportIssue[],
  columnOverrides?: Record<string, string>
) {
  const parsed: TripImportRow[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const vehiclePlateNumber = getFieldValue(
      row,
      tripFieldAliases.vehiclePlateNumber,
      'vehiclePlateNumber',
      columnOverrides
    );
    const driverLicenseNumber = getFieldValue(
      row,
      tripFieldAliases.driverLicenseNumber,
      'driverLicenseNumber',
      columnOverrides
    );
    const date = parseDateValue(getFieldValue(row, tripFieldAliases.date, 'date', columnOverrides));
    const startLocation = getFieldValue(row, tripFieldAliases.startLocation, 'startLocation', columnOverrides);
    const destination = getFieldValue(row, tripFieldAliases.destination, 'destination', columnOverrides);
    const distance = parseNumberValue(getFieldValue(row, tripFieldAliases.distance, 'distance', columnOverrides));

    const rowIssuesBefore = issues.length;
    addRequiredTextIssue(sheet, rowNumber, 'Vehicle Plate Number', vehiclePlateNumber, issues);
    addRequiredTextIssue(sheet, rowNumber, 'Driver License Number', driverLicenseNumber, issues);
    if (!date) addInvalidIssue(sheet, rowNumber, 'Date', issues, 'a valid date');
    addRequiredTextIssue(sheet, rowNumber, 'Start Location', startLocation, issues);
    addRequiredTextIssue(sheet, rowNumber, 'Destination', destination, issues);
    if (distance === undefined) addInvalidIssue(sheet, rowNumber, 'Distance', issues, 'a number');

    if (issues.length > rowIssuesBefore) {
      return;
    }

    parsed.push({
      sourceRow: rowNumber,
      vehiclePlateNumber,
      driverLicenseNumber,
      date: date!,
      startLocation,
      destination,
      distance: distance!,
      purpose: getFieldValue(row, tripFieldAliases.purpose, 'purpose', columnOverrides) || undefined,
    });
  });

  return parsed;
}

function addDuplicateRowIssues<T extends { sourceRow: number }>(
  rows: T[],
  keyFn: (row: T) => string,
  buildMessage: (row: T) => string,
  sheet: string,
  severity: ImportIssueSeverity,
  issues: ImportIssue[]
) {
  const rowsByKey = new Map<string, T[]>();

  for (const row of rows) {
    const key = keyFn(row);
    if (!key) {
      continue;
    }

    const matches = rowsByKey.get(key) ?? [];
    matches.push(row);
    rowsByKey.set(key, matches);
  }

  for (const matchingRows of rowsByKey.values()) {
    if (matchingRows.length < 2) {
      continue;
    }

    for (const row of matchingRows) {
      issues.push(issue(sheet, row.sourceRow, severity, buildMessage(row)));
    }
  }
}

async function appendPreflightIssues(payload: ImportPayload, issues: ImportIssue[]) {
  const [vehicles, drivers, assignments, fuelLogs, maintenanceRecords, incidents, trips] = await Promise.all([
    listVehicles(),
    listDrivers(),
    listAssignments(),
    listFuelLogs(),
    listMaintenance(),
    listIncidents(),
    listTrips(),
  ]);

  const existingVehiclePlates = new Set(vehicles.map((vehicle) => normalizeLookup(vehicle.plateNumber)));
  const existingDriverLicenses = new Set(drivers.map((driver) => normalizeLookup(driver.licenseNumber)));
  const workbookVehiclePlates = new Set(payload.vehicles.map((vehicle) => normalizeLookup(vehicle.plateNumber)));
  const workbookDriverLicenses = new Set(payload.drivers.map((driver) => normalizeLookup(driver.licenseNumber)));
  const knownVehiclePlates = new Set([...existingVehiclePlates, ...workbookVehiclePlates]);
  const knownDriverLicenses = new Set([...existingDriverLicenses, ...workbookDriverLicenses]);

  const plateByVehicleId = new Map(vehicles.map((vehicle) => [vehicle.id, normalizeLookup(vehicle.plateNumber)]));
  const licenseByDriverId = new Map(drivers.map((driver) => [driver.id, normalizeLookup(driver.licenseNumber)]));

  addDuplicateRowIssues(
    payload.vehicles,
    (row) => normalizeLookup(row.plateNumber),
    (row) => `Plate number ${row.plateNumber} appears multiple times in this workbook.`,
    'Vehicles',
    'error',
    issues
  );
  addDuplicateRowIssues(
    payload.drivers,
    (row) => normalizeLookup(row.licenseNumber),
    (row) => `License number ${row.licenseNumber} appears multiple times in this workbook.`,
    'Drivers',
    'error',
    issues
  );
  addDuplicateRowIssues(
    payload.assignments,
    (row) =>
      `${normalizeLookup(row.vehiclePlateNumber)}|${normalizeLookup(row.driverLicenseNumber)}|${row.startDate}|${row.endDate ?? ''}`,
    (row) =>
      `Assignment ${row.vehiclePlateNumber} -> ${row.driverLicenseNumber} starting ${row.startDate} appears multiple times in this workbook.`,
    'Assignments',
    'warning',
    issues
  );
  addDuplicateRowIssues(
    payload.fuelLogs,
    (row) => `${normalizeLookup(row.vehiclePlateNumber)}|${row.date}|${row.odometer}|${row.cost}`,
    (row) => `Fuel log for ${row.vehiclePlateNumber} on ${row.date} appears multiple times in this workbook.`,
    'Fuel Logs',
    'warning',
    issues
  );
  addDuplicateRowIssues(
    payload.maintenance,
    (row) => `${normalizeLookup(row.vehiclePlateNumber)}|${row.scheduledDate}|${normalizeLookup(row.serviceType)}`,
    (row) =>
      `Maintenance row for ${row.vehiclePlateNumber} on ${row.scheduledDate} appears multiple times in this workbook.`,
    'Maintenance',
    'warning',
    issues
  );
  addDuplicateRowIssues(
    payload.incidents,
    (row) => `${normalizeLookup(row.vehiclePlateNumber)}|${row.date}|${normalizeLookup(row.title)}`,
    (row) => `Incident "${row.title}" for ${row.vehiclePlateNumber} on ${row.date} appears multiple times in this workbook.`,
    'Incidents',
    'warning',
    issues
  );
  addDuplicateRowIssues(
    payload.trips,
    (row) =>
      `${normalizeLookup(row.vehiclePlateNumber)}|${normalizeLookup(row.driverLicenseNumber)}|${row.date}|${normalizeLookup(row.startLocation)}|${normalizeLookup(row.destination)}`,
    (row) => `Trip ${row.startLocation} -> ${row.destination} on ${row.date} appears multiple times in this workbook.`,
    'Trips',
    'warning',
    issues
  );

  for (const row of payload.vehicles) {
    if (existingVehiclePlates.has(normalizeLookup(row.plateNumber))) {
      issues.push(issue('Vehicles', row.sourceRow, 'warning', `Vehicle ${row.plateNumber} already exists and will be skipped.`));
    }
  }

  for (const row of payload.drivers) {
    if (existingDriverLicenses.has(normalizeLookup(row.licenseNumber))) {
      issues.push(
        issue('Drivers', row.sourceRow, 'warning', `Driver ${row.licenseNumber} already exists and will be skipped.`)
      );
    }
  }

  const existingAssignmentKeys = new Set(
    assignments
      .map((assignment) => {
        const plate = plateByVehicleId.get(assignment.vehicleId);
        const license = licenseByDriverId.get(assignment.driverId);
        if (!plate || !license) {
          return null;
        }
        return `${plate}|${license}|${assignment.startDate}|${assignment.endDate ?? ''}`;
      })
      .filter((value): value is string => Boolean(value))
  );
  const existingFuelLogKeys = new Set(
    fuelLogs
      .map((log) => {
        const plate = plateByVehicleId.get(log.vehicleId);
        if (!plate) {
          return null;
        }
        return `${plate}|${log.date}|${log.odometer}|${log.cost}`;
      })
      .filter((value): value is string => Boolean(value))
  );
  const existingMaintenanceKeys = new Set(
    maintenanceRecords
      .map((record) => {
        const plate = plateByVehicleId.get(record.vehicleId);
        if (!plate) {
          return null;
        }
        return `${plate}|${record.scheduledDate}|${normalizeLookup(record.serviceType)}`;
      })
      .filter((value): value is string => Boolean(value))
  );
  const existingIncidentKeys = new Set(
    incidents
      .map((record) => {
        const plate = plateByVehicleId.get(record.vehicleId);
        if (!plate) {
          return null;
        }
        return `${plate}|${record.date}|${normalizeLookup(record.title)}`;
      })
      .filter((value): value is string => Boolean(value))
  );
  const existingTripKeys = new Set(
    trips
      .map((trip) => {
        const plate = plateByVehicleId.get(trip.vehicleId);
        const license = licenseByDriverId.get(trip.driverId);
        if (!plate || !license) {
          return null;
        }
        return `${plate}|${license}|${trip.date}|${normalizeLookup(trip.startLocation)}|${normalizeLookup(trip.destination)}`;
      })
      .filter((value): value is string => Boolean(value))
  );

  for (const row of payload.assignments) {
    const vehicleKey = normalizeLookup(row.vehiclePlateNumber);
    const driverKey = normalizeLookup(row.driverLicenseNumber);

    if (!knownVehiclePlates.has(vehicleKey)) {
      issues.push(
        issue('Assignments', row.sourceRow, 'error', `Vehicle ${row.vehiclePlateNumber} was not found in this workbook or the current system.`)
      );
    }
    if (!knownDriverLicenses.has(driverKey)) {
      issues.push(
        issue('Assignments', row.sourceRow, 'error', `Driver ${row.driverLicenseNumber} was not found in this workbook or the current system.`)
      );
    }
    if (existingAssignmentKeys.has(`${vehicleKey}|${driverKey}|${row.startDate}|${row.endDate ?? ''}`)) {
      issues.push(
        issue(
          'Assignments',
          row.sourceRow,
          'warning',
          `Assignment ${row.vehiclePlateNumber} -> ${row.driverLicenseNumber} starting ${row.startDate} already exists and will be skipped.`
        )
      );
    }
  }

  for (const row of payload.fuelLogs) {
    const vehicleKey = normalizeLookup(row.vehiclePlateNumber);
    if (!knownVehiclePlates.has(vehicleKey)) {
      issues.push(
        issue('Fuel Logs', row.sourceRow, 'error', `Vehicle ${row.vehiclePlateNumber} was not found in this workbook or the current system.`)
      );
    }
    if (existingFuelLogKeys.has(`${vehicleKey}|${row.date}|${row.odometer}|${row.cost}`)) {
      issues.push(
        issue('Fuel Logs', row.sourceRow, 'warning', `Fuel log for ${row.vehiclePlateNumber} on ${row.date} already exists and will be skipped.`)
      );
    }
  }

  for (const row of payload.maintenance) {
    const vehicleKey = normalizeLookup(row.vehiclePlateNumber);
    if (!knownVehiclePlates.has(vehicleKey)) {
      issues.push(
        issue('Maintenance', row.sourceRow, 'error', `Vehicle ${row.vehiclePlateNumber} was not found in this workbook or the current system.`)
      );
    }
    if (existingMaintenanceKeys.has(`${vehicleKey}|${row.scheduledDate}|${normalizeLookup(row.serviceType)}`)) {
      issues.push(
        issue(
          'Maintenance',
          row.sourceRow,
          'warning',
          `Maintenance row for ${row.vehiclePlateNumber} on ${row.scheduledDate} already exists and will be skipped.`
        )
      );
    }
  }

  for (const row of payload.incidents) {
    const vehicleKey = normalizeLookup(row.vehiclePlateNumber);
    if (!knownVehiclePlates.has(vehicleKey)) {
      issues.push(
        issue('Incidents', row.sourceRow, 'error', `Vehicle ${row.vehiclePlateNumber} was not found in this workbook or the current system.`)
      );
    }
    if (row.driverLicenseNumber && !knownDriverLicenses.has(normalizeLookup(row.driverLicenseNumber))) {
      issues.push(
        issue(
          'Incidents',
          row.sourceRow,
          'error',
          `Driver ${row.driverLicenseNumber} was not found in this workbook or the current system.`
        )
      );
    }
    if (existingIncidentKeys.has(`${vehicleKey}|${row.date}|${normalizeLookup(row.title)}`)) {
      issues.push(
        issue(
          'Incidents',
          row.sourceRow,
          'warning',
          `Incident "${row.title}" for ${row.vehiclePlateNumber} on ${row.date} already exists and will be skipped.`
        )
      );
    }
  }

  for (const row of payload.trips) {
    const vehicleKey = normalizeLookup(row.vehiclePlateNumber);
    const driverKey = normalizeLookup(row.driverLicenseNumber);

    if (!knownVehiclePlates.has(vehicleKey)) {
      issues.push(
        issue('Trips', row.sourceRow, 'error', `Vehicle ${row.vehiclePlateNumber} was not found in this workbook or the current system.`)
      );
    }
    if (!knownDriverLicenses.has(driverKey)) {
      issues.push(
        issue('Trips', row.sourceRow, 'error', `Driver ${row.driverLicenseNumber} was not found in this workbook or the current system.`)
      );
    }
    if (
      existingTripKeys.has(
        `${vehicleKey}|${driverKey}|${row.date}|${normalizeLookup(row.startLocation)}|${normalizeLookup(row.destination)}`
      )
    ) {
      issues.push(
        issue(
          'Trips',
          row.sourceRow,
          'warning',
          `Trip ${row.startLocation} -> ${row.destination} on ${row.date} already exists and will be skipped.`
        )
      );
    }
  }
}

export async function parseImportWorkbook(
  file: File,
  options?: ParseImportWorkbookOptions
): Promise<ImportWorkbookPreview> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const issues: ImportIssue[] = [];
  const payload = emptyPayload();
  const sheets: ImportSheetPreview[] = [];
  const unmatchedSheets: ImportUnmatchedSheetPreview[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rows = getNormalizedRows(worksheet);
    const manualOverride = options?.sheetOverrides?.[sheetName];

    if (manualOverride === 'ignore') {
      issues.push(issue('Workbook', 1, 'warning', `Sheet "${sheetName}" was ignored by manual mapping.`));
      continue;
    }

    const resolvedSheet = manualOverride
      ? { key: manualOverride, inferred: false }
      : resolveSheetKey(sheetName, rows);

    if (!resolvedSheet) {
      unmatchedSheets.push({
        sheetName,
        sourceRows: rows.length,
        headers: getWorksheetHeaders(worksheet).slice(0, 8),
        suggestedKey: suggestSheetKey(rows),
      });
      continue;
    }

    const sheetKey = resolvedSheet.key;
    const columnOverrides = options?.columnOverrides?.[sheetName];
    let validRows = 0;

    if (manualOverride) {
      issues.push(
        issue(
          'Workbook',
          1,
          'warning',
          `Sheet "${sheetName}" was mapped manually to ${sheetLabels[sheetKey]}.`
        )
      );
    } else if (resolvedSheet.inferred) {
      issues.push(
        issue(
          'Workbook',
          1,
          'warning',
          `Sheet "${sheetName}" was recognized as ${sheetLabels[sheetKey]} based on its column headings.`
        )
      );
    }

    switch (sheetKey) {
      case 'vehicles':
        payload.vehicles = parseVehicles(rows, sheetLabels[sheetKey], issues, columnOverrides);
        validRows = payload.vehicles.length;
        break;
      case 'drivers':
        payload.drivers = parseDrivers(rows, sheetLabels[sheetKey], issues, columnOverrides);
        validRows = payload.drivers.length;
        break;
      case 'assignments':
        payload.assignments = parseAssignments(rows, sheetLabels[sheetKey], issues, columnOverrides);
        validRows = payload.assignments.length;
        break;
      case 'fuelLogs':
        payload.fuelLogs = parseFuelLogs(rows, sheetLabels[sheetKey], issues, columnOverrides);
        validRows = payload.fuelLogs.length;
        break;
      case 'maintenance':
        payload.maintenance = parseMaintenance(rows, sheetLabels[sheetKey], issues, columnOverrides);
        validRows = payload.maintenance.length;
        break;
      case 'incidents':
        payload.incidents = parseIncidents(rows, sheetLabels[sheetKey], issues, columnOverrides);
        validRows = payload.incidents.length;
        break;
      case 'trips':
        payload.trips = parseTrips(rows, sheetLabels[sheetKey], issues, columnOverrides);
        validRows = payload.trips.length;
        break;
    }

    sheets.push({
      key: sheetKey,
      label: sheetLabels[sheetKey],
      detectedSheetName: sheetName,
      headers: getWorksheetHeaders(worksheet),
      sourceRows: rows.length,
      validRows,
    });
  }

  if (sheets.length === 0) {
    issues.push(
      issue(
        'Workbook',
        1,
        'error',
        'No supported sheets were found. Use the provided template, standard sheet names, or include recognizable legacy column headings for Vehicles, Drivers, Trips, Fuel Logs, Maintenance, Incidents, or Assignments.'
      )
    );
  }

  if (sheets.length > 0) {
    await appendPreflightIssues(payload, issues);
  }

  const totalRows = sheets.reduce((sum, sheet) => sum + sheet.sourceRows, 0);
  const validRows = sheets.reduce((sum, sheet) => sum + sheet.validRows, 0);
  const hasErrors = issues.some((item) => item.severity === 'error');

  return {
    fileName: file.name,
    sheets,
    unmatchedSheets,
    issues,
    totalRows,
    validRows,
    canImport: validRows > 0 && !hasErrors,
    payload,
  };
}

function buildVehicleRecord(row: VehicleImportRow): Vehicle {
  const timestamp = new Date().toISOString();

  return {
    id: createId('veh'),
    plateNumber: row.plateNumber,
    vehicleType: row.vehicleType,
    brand: row.brand,
    model: row.model,
    year: row.year,
    vin: row.vin,
    engineNumber: row.engineNumber,
    purchaseDate: row.purchaseDate,
    purchaseCost: row.purchaseCost,
    vendor: row.vendor,
    warrantyExpiry: row.warrantyExpiry,
    status: row.status,
    currentOdometer: row.currentOdometer,
    nextServiceDueOdometer: row.nextServiceDueOdometer,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function buildDriverRecord(row: DriverImportRow): Driver {
  const timestamp = new Date().toISOString();

  return {
    id: createId('drv'),
    fullName: row.fullName,
    phoneNumber: row.phoneNumber,
    email: row.email,
    licenseNumber: row.licenseNumber,
    licenseExpiry: row.licenseExpiry,
    dateOfBirth: row.dateOfBirth,
    hireDate: row.hireDate,
    address: row.address,
    status: row.status,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export async function executeWorkbookImport(preview: ImportWorkbookPreview): Promise<ImportExecutionResult> {
  const result: ImportExecutionResult = {
    created: emptyCountRecord(),
    skipped: emptyCountRecord(),
    issues: [],
  };

  const [vehicles, drivers, assignments, fuelLogs, maintenanceRecords, incidents, trips] =
    await Promise.all([
      listVehicles(),
      listDrivers(),
      listAssignments(),
      listFuelLogs(),
      listMaintenance(),
      listIncidents(),
      listTrips(),
    ]);

  const vehiclesByPlate = new Map(vehicles.map((vehicle) => [normalizeLookup(vehicle.plateNumber), vehicle]));
  const driversByLicense = new Map(drivers.map((driver) => [normalizeLookup(driver.licenseNumber), driver]));
  const assignmentKeys = new Set(
    assignments.map((assignment) => `${assignment.vehicleId}|${assignment.driverId}|${assignment.startDate}|${assignment.endDate ?? ''}`)
  );
  const fuelLogKeys = new Set(
    fuelLogs.map((log) => `${log.vehicleId}|${log.date}|${log.odometer}|${log.cost}`)
  );
  const maintenanceKeys = new Set(
    maintenanceRecords.map((record) => `${record.vehicleId}|${record.scheduledDate}|${normalizeLookup(record.serviceType)}`)
  );
  const incidentKeys = new Set(
    incidents.map((incident) => `${incident.vehicleId}|${incident.date}|${normalizeLookup(incident.title)}`)
  );
  const tripKeys = new Set(
    trips.map(
      (trip) =>
        `${trip.vehicleId}|${trip.driverId}|${trip.date}|${normalizeLookup(trip.startLocation)}|${normalizeLookup(trip.destination)}`
    )
  );

  for (const row of preview.payload.vehicles) {
    const key = normalizeLookup(row.plateNumber);
    if (vehiclesByPlate.has(key)) {
      result.skipped.vehicles += 1;
      result.issues.push(issue('Vehicles', row.sourceRow, 'warning', `Skipped existing vehicle ${row.plateNumber}.`));
      continue;
    }

    const createdVehicle = await createVehicle(buildVehicleRecord(row));
    vehiclesByPlate.set(key, createdVehicle);
    result.created.vehicles += 1;
  }

  for (const row of preview.payload.drivers) {
    const key = normalizeLookup(row.licenseNumber);
    if (driversByLicense.has(key)) {
      result.skipped.drivers += 1;
      result.issues.push(issue('Drivers', row.sourceRow, 'warning', `Skipped existing driver ${row.licenseNumber}.`));
      continue;
    }

    const createdDriver = await createDriver(buildDriverRecord(row));
    driversByLicense.set(key, createdDriver);
    result.created.drivers += 1;
  }

  const vehiclesToSync = new Set<string>();

  for (const row of preview.payload.assignments) {
    const vehicle = vehiclesByPlate.get(normalizeLookup(row.vehiclePlateNumber));
    const driver = driversByLicense.get(normalizeLookup(row.driverLicenseNumber));

    if (!vehicle || !driver) {
      result.skipped.assignments += 1;
      result.issues.push(
        issue(
          'Assignments',
          row.sourceRow,
          'warning',
          `Skipped assignment ${row.vehiclePlateNumber} -> ${row.driverLicenseNumber} because the vehicle or driver could not be found.`
        )
      );
      continue;
    }

    const key = `${vehicle.id}|${driver.id}|${row.startDate}|${row.endDate ?? ''}`;
    if (assignmentKeys.has(key)) {
      result.skipped.assignments += 1;
      result.issues.push(
        issue(
          'Assignments',
          row.sourceRow,
          'warning',
          `Skipped duplicate assignment for ${row.vehiclePlateNumber} starting ${row.startDate}.`
        )
      );
      continue;
    }

    const timestamp = new Date().toISOString();
    const createdAssignment: Assignment = {
      id: createId('asg'),
      vehicleId: vehicle.id,
      driverId: driver.id,
      startDate: row.startDate,
      endDate: row.endDate,
      createdAt: timestamp,
    };

    await createAssignment(createdAssignment);
    assignmentKeys.add(key);
    vehiclesToSync.add(vehicle.id);
    result.created.assignments += 1;
  }

  for (const row of preview.payload.fuelLogs) {
    const vehicle = vehiclesByPlate.get(normalizeLookup(row.vehiclePlateNumber));
    if (!vehicle) {
      result.skipped.fuelLogs += 1;
      result.issues.push(
        issue(
          'Fuel Logs',
          row.sourceRow,
          'warning',
          `Skipped fuel log for ${row.vehiclePlateNumber} because the vehicle could not be found.`
        )
      );
      continue;
    }

    const key = `${vehicle.id}|${row.date}|${row.odometer}|${row.cost}`;
    if (fuelLogKeys.has(key)) {
      result.skipped.fuelLogs += 1;
      result.issues.push(
        issue(
          'Fuel Logs',
          row.sourceRow,
          'warning',
          `Skipped duplicate fuel log for ${row.vehiclePlateNumber} on ${row.date}.`
        )
      );
      continue;
    }

    const createdFuelLog: FuelLog = {
      id: createId('fuel'),
      vehicleId: vehicle.id,
      date: row.date,
      liters: row.liters,
      cost: row.cost,
      odometer: row.odometer,
      station: row.station,
      createdAt: new Date().toISOString(),
    };

    await createFuelLog(createdFuelLog);
    fuelLogKeys.add(key);
    result.created.fuelLogs += 1;
  }

  for (const row of preview.payload.maintenance) {
    const vehicle = vehiclesByPlate.get(normalizeLookup(row.vehiclePlateNumber));
    if (!vehicle) {
      result.skipped.maintenance += 1;
      result.issues.push(
        issue(
          'Maintenance',
          row.sourceRow,
          'warning',
          `Skipped maintenance row for ${row.vehiclePlateNumber} because the vehicle could not be found.`
        )
      );
      continue;
    }

    const key = `${vehicle.id}|${row.scheduledDate}|${normalizeLookup(row.serviceType)}`;
    if (maintenanceKeys.has(key)) {
      result.skipped.maintenance += 1;
      result.issues.push(
        issue(
          'Maintenance',
          row.sourceRow,
          'warning',
          `Skipped duplicate maintenance row for ${row.vehiclePlateNumber} on ${row.scheduledDate}.`
        )
      );
      continue;
    }

    const timestamp = new Date().toISOString();
    const createdMaintenance: Maintenance = {
      id: createId('mnt'),
      vehicleId: vehicle.id,
      serviceType: row.serviceType,
      status: row.status,
      scheduledDate: row.scheduledDate,
      completedDate: row.completedDate,
      cost: row.cost,
      serviceProvider: row.serviceProvider,
      description: row.description,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await createMaintenance(createdMaintenance);
    maintenanceKeys.add(key);
    result.created.maintenance += 1;
  }

  for (const row of preview.payload.incidents) {
    const vehicle = vehiclesByPlate.get(normalizeLookup(row.vehiclePlateNumber));
    if (!vehicle) {
      result.skipped.incidents += 1;
      result.issues.push(
        issue(
          'Incidents',
          row.sourceRow,
          'warning',
          `Skipped incident "${row.title}" because vehicle ${row.vehiclePlateNumber} could not be found.`
        )
      );
      continue;
    }

    const driver = row.driverLicenseNumber
      ? driversByLicense.get(normalizeLookup(row.driverLicenseNumber))
      : undefined;
    const key = `${vehicle.id}|${row.date}|${normalizeLookup(row.title)}`;

    if (incidentKeys.has(key)) {
      result.skipped.incidents += 1;
      result.issues.push(issue('Incidents', row.sourceRow, 'warning', `Skipped duplicate incident "${row.title}".`));
      continue;
    }

    const timestamp = new Date().toISOString();
    const createdIncident: Incident = {
      id: createId('inc'),
      vehicleId: vehicle.id,
      driverId: driver?.id,
      title: row.title,
      date: row.date,
      description: row.description,
      severity: row.severity,
      status: row.status,
      location: row.location,
      repairCost: row.repairCost,
      finalRepairCost: row.finalRepairCost,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await createIncident(createdIncident, { suppressNotification: true });
    incidentKeys.add(key);
    result.created.incidents += 1;
  }

  for (const row of preview.payload.trips) {
    const vehicle = vehiclesByPlate.get(normalizeLookup(row.vehiclePlateNumber));
    const driver = driversByLicense.get(normalizeLookup(row.driverLicenseNumber));

    if (!vehicle || !driver) {
      result.skipped.trips += 1;
      result.issues.push(
        issue(
          'Trips',
          row.sourceRow,
          'warning',
          `Skipped trip ${row.startLocation} -> ${row.destination} because the vehicle or driver could not be found.`
        )
      );
      continue;
    }

    const key = `${vehicle.id}|${driver.id}|${row.date}|${normalizeLookup(row.startLocation)}|${normalizeLookup(row.destination)}`;
    if (tripKeys.has(key)) {
      result.skipped.trips += 1;
      result.issues.push(
        issue(
          'Trips',
          row.sourceRow,
          'warning',
          `Skipped duplicate trip ${row.startLocation} -> ${row.destination} on ${row.date}.`
        )
      );
      continue;
    }

    const createdTrip: Trip = {
      id: createId('trip'),
      vehicleId: vehicle.id,
      driverId: driver.id,
      date: row.date,
      startLocation: row.startLocation,
      destination: row.destination,
      distance: row.distance,
      purpose: row.purpose,
      createdAt: new Date().toISOString(),
    };

    await createTrip(createdTrip);
    tripKeys.add(key);
    result.created.trips += 1;
  }

  if (vehiclesToSync.size > 0) {
    const allAssignments = await listAssignments();
    const today = safeDateLabel();
    const latestActiveAssignmentByVehicle = new Map<string, Assignment>();

    for (const assignment of allAssignments) {
      const isActive = !assignment.endDate || assignment.endDate >= today;
      if (!isActive) {
        continue;
      }

      const existingAssignment = latestActiveAssignmentByVehicle.get(assignment.vehicleId);
      if (
        !existingAssignment ||
        new Date(assignment.startDate).getTime() > new Date(existingAssignment.startDate).getTime()
      ) {
        latestActiveAssignmentByVehicle.set(assignment.vehicleId, assignment);
      }
    }

    for (const vehicleId of vehiclesToSync) {
      const activeAssignment = latestActiveAssignmentByVehicle.get(vehicleId);
      await updateVehicleCurrentDriver(vehicleId, activeAssignment?.driverId);
    }
  }

  return result;
}

export function downloadImportTemplate() {
  exportWorkbook({
    filename: `fleet-import-template-${safeDateLabel()}.xlsx`,
    sheets: [
      {
        name: 'Read Me',
        rows: [
          {
            Sheet: 'How to use this workbook',
            Notes:
              'Fill the sheets you need and leave the rest alone. Google Sheets users can export as .xlsx and upload it here.',
          },
          {
            Sheet: 'Matching rules',
            Notes:
              'Assignments, fuel logs, maintenance, incidents, and trips match vehicles by plate number and drivers by license number.',
          },
          {
            Sheet: 'Supported sheets',
            Notes: 'Vehicles, Drivers, Assignments, Fuel Logs, Maintenance, Incidents, Trips',
          },
        ],
      },
      {
        name: 'Vehicles',
        rows: [
          {
            'Plate Number': 'LND-482XZ',
            'Vehicle Type': 'SUV',
            Brand: 'Toyota',
            Model: 'Prado',
            Year: 2022,
            VIN: 'JTDBR32E420123456',
            'Engine Number': 'ENG-PRD-2211',
            'Purchase Date': '2024-01-12',
            'Purchase Cost': 42500000,
            Vendor: 'Toyota Nigeria',
            'Warranty Expiry': '2027-01-12',
            Status: 'Active',
            'Current Odometer': 28500,
            'Next Service Due Odometer': 32000,
          },
        ],
      },
      {
        name: 'Drivers',
        rows: [
          {
            'Full Name': 'Adewale Akinola',
            'Phone Number': '+2348012345678',
            Email: 'adewale.akinola@example.com',
            'License Number': 'DRV-004821-LG',
            'License Expiry': '2027-08-14',
            'Date of Birth': '1988-02-11',
            'Hire Date': '2022-04-18',
            Address: 'Lekki Phase 1, Lagos',
            Status: 'Active',
          },
        ],
      },
      {
        name: 'Assignments',
        rows: [
          {
            'Vehicle Plate Number': 'LND-482XZ',
            'Driver License Number': 'DRV-004821-LG',
            'Start Date': '2026-03-01',
            'End Date': '',
          },
        ],
      },
      {
        name: 'Fuel Logs',
        rows: [
          {
            'Vehicle Plate Number': 'LND-482XZ',
            Date: '2026-03-18',
            Liters: 72,
            Cost: 64800,
            Odometer: 28140,
            Station: 'Mobil Lekki',
          },
        ],
      },
      {
        name: 'Maintenance',
        rows: [
          {
            'Vehicle Plate Number': 'LND-482XZ',
            'Service Type': 'General Service',
            Status: 'Scheduled',
            'Scheduled Date': '2026-04-18',
            'Completed Date': '',
            Cost: 95000,
            'Service Provider': 'Toyota Service Centre',
            Description: 'Routine quarterly service',
          },
        ],
      },
      {
        name: 'Incidents',
        rows: [
          {
            'Vehicle Plate Number': 'LND-482XZ',
            'Driver License Number': 'DRV-004821-LG',
            Title: 'Rear bumper scratch',
            Date: '2026-03-20',
            Description: 'Minor impact while reversing into parking slot.',
            Severity: 'Minor',
            Status: 'Under Review',
            Location: 'Lekki Free Zone Gate 2',
            'Repair Cost': 25000,
            'Final Repair Cost': '',
          },
        ],
      },
      {
        name: 'Trips',
        rows: [
          {
            'Vehicle Plate Number': 'LND-482XZ',
            'Driver License Number': 'DRV-004821-LG',
            Date: '2026-03-21',
            'Start Location': 'LFZDC HQ',
            Destination: 'Lekki Port',
            Distance: 18,
            Purpose: 'Stakeholder inspection',
          },
        ],
      },
    ],
  });
}

export function downloadLegacyImportSampleWorkbook() {
  exportWorkbook({
    filename: `fleet-legacy-sample-${safeDateLabel()}.xlsx`,
    sheets: [
      {
        name: 'Fleet Register',
        rows: [
          {
            'Registration Number': 'LND-482XZ',
            Category: 'SUV',
            Make: 'Toyota',
            Variant: 'Prado',
            'Model Year': 2022,
            'Chassis Number': 'JTDBR32E420123456',
            'Engine No': 'ENG-PRD-2211',
            'Acquisition Date': '2024-01-12',
            'Vehicle Cost': 42500000,
            Dealer: 'Toyota Nigeria',
            'Warranty End Date': '2027-01-12',
            Status: 'Active',
            Mileage: 28500,
            'Next Service Mileage': 32000,
          },
          {
            'Registration Number': 'ABJ-771KM',
            Category: 'Pickup',
            Make: 'Ford',
            Variant: 'Ranger',
            'Model Year': 2021,
            'Chassis Number': '1FTER4FH9MLA99887',
            'Engine No': 'ENG-RNG-1182',
            'Acquisition Date': '2023-06-03',
            'Vehicle Cost': 31800000,
            Dealer: 'Coscharis Motors',
            'Warranty End Date': '2026-06-03',
            Status: 'Active',
            Mileage: 46110,
            'Next Service Mileage': 50000,
          },
        ],
      },
      {
        name: 'Driver Master',
        rows: [
          {
            'Driver Name': 'Adewale Akinola',
            Mobile: '+2348012345678',
            'Email Address': 'adewale.akinola@example.com',
            'Licence Number': 'DRV-004821-LG',
            'Licence Expiry': '2027-08-14',
            DOB: '1988-02-11',
            'Employment Date': '2022-04-18',
            'Residential Address': 'Lekki Phase 1, Lagos',
            Status: 'Active',
          },
          {
            'Driver Name': 'Fatima Bello',
            Mobile: '+2348098765432',
            'Email Address': 'fatima.bello@example.com',
            'Licence Number': 'DRV-009117-ABJ',
            'Licence Expiry': '2028-01-20',
            DOB: '1990-09-03',
            'Employment Date': '2023-01-09',
            'Residential Address': 'Gwarinpa, Abuja',
            Status: 'Active',
          },
        ],
      },
      {
        name: 'Vehicle Allocation Log',
        rows: [
          {
            'Vehicle Registration Number': 'LND-482XZ',
            'Driver Licence Number': 'DRV-004821-LG',
            'Allocation Start Date': '2026-03-01',
            'Allocation End Date': '',
          },
          {
            'Vehicle Registration Number': 'ABJ-771KM',
            'Driver Licence Number': 'DRV-009117-ABJ',
            'Allocation Start Date': '2026-03-06',
            'Allocation End Date': '',
          },
        ],
      },
      {
        name: 'Fuel Purchases',
        rows: [
          {
            'Vehicle Registration Number': 'LND-482XZ',
            'Fuel Date': '2026-03-18',
            Litres: 72,
            Amount: 64800,
            Mileage: 28140,
            'Station Name': 'Mobil Lekki',
          },
          {
            'Vehicle Registration Number': 'ABJ-771KM',
            'Fuel Date': '2026-03-19',
            Litres: 65,
            Amount: 59150,
            Mileage: 45890,
            'Station Name': 'NIPCO Wuse',
          },
        ],
      },
      {
        name: 'Workshop Jobs',
        rows: [
          {
            'Vehicle Registration Number': 'LND-482XZ',
            'Maintenance Type': 'General Service',
            Status: 'Scheduled',
            'Planned Date': '2026-04-18',
            'Completion Date': '',
            'Service Cost': 95000,
            Garage: 'Toyota Service Centre',
            Notes: 'Routine quarterly service',
          },
          {
            'Vehicle Registration Number': 'ABJ-771KM',
            'Maintenance Type': 'Brake Service',
            Status: 'Completed',
            'Planned Date': '2026-03-11',
            'Completion Date': '2026-03-12',
            'Service Cost': 145000,
            Garage: 'Mabushi Fleet Workshop',
            Notes: 'Front brake pads and discs replaced',
          },
        ],
      },
      {
        name: 'Accidents',
        rows: [
          {
            'Vehicle Registration Number': 'LND-482XZ',
            'Driver Licence Number': 'DRV-004821-LG',
            Subject: 'Rear bumper scratch',
            'Incident Date': '2026-03-20',
            Details: 'Minor impact while reversing into parking slot.',
            Impact: 'Minor',
            Status: 'Under Review',
            'Incident Location': 'Lekki Free Zone Gate 2',
            'Cost Estimate': 25000,
            'Final Cost': '',
          },
        ],
      },
      {
        name: 'Journey Log',
        rows: [
          {
            'Vehicle Registration Number': 'LND-482XZ',
            'Driver Licence Number': 'DRV-004821-LG',
            'Travel Date': '2026-03-21',
            Origin: 'LFZDC HQ',
            To: 'Lekki Port',
            'Trip Distance': 18,
            Reason: 'Stakeholder inspection',
          },
          {
            'Vehicle Registration Number': 'ABJ-771KM',
            'Driver Licence Number': 'DRV-009117-ABJ',
            'Travel Date': '2026-03-22',
            Origin: 'Operations Base Abuja',
            To: 'Kubwa Site Office',
            'Trip Distance': 26,
            Reason: 'Site supervision',
          },
        ],
      },
    ],
  });
}
