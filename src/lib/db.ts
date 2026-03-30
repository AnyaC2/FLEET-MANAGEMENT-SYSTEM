import type {
  Vehicle,
  Driver,
  Assignment,
  FuelLog,
  Maintenance,
  Incident,
  Trip,
  Document,
  Notification,
  User,
} from '@/types';

// Database keys
const DB_KEYS = {
  vehicles: 'lfz_fleet_vehicles',
  drivers: 'lfz_fleet_drivers',
  assignments: 'lfz_fleet_assignments',
  fuelLogs: 'lfz_fleet_fuel_logs',
  maintenance: 'lfz_fleet_maintenance',
  incidents: 'lfz_fleet_incidents',
  trips: 'lfz_fleet_trips',
  documents: 'lfz_fleet_documents',
  notifications: 'lfz_fleet_notifications',
  users: 'lfz_fleet_users',
  currentUser: 'lfz_fleet_current_user',
};

// Generic CRUD operations
class Database<T> {
  private key: string;

  constructor(key: string) {
    this.key = key;
  }

  getAll(): T[] {
    const data = localStorage.getItem(this.key);
    return data ? JSON.parse(data) : [];
  }

  getById(id: string): T | undefined {
    const items = this.getAll();
    return items.find((item: any) => item.id === id);
  }

  create(item: T): T {
    const items = this.getAll();
    items.push(item);
    localStorage.setItem(this.key, JSON.stringify(items));
    return item;
  }

  update(id: string, updates: Partial<T>): T | undefined {
    const items = this.getAll();
    const index = items.findIndex((item: any) => item.id === id);
    if (index === -1) return undefined;
    items[index] = { ...items[index], ...updates };
    localStorage.setItem(this.key, JSON.stringify(items));
    return items[index];
  }

  delete(id: string): boolean {
    const items = this.getAll();
    const filtered = items.filter((item: any) => item.id !== id);
    if (filtered.length === items.length) return false;
    localStorage.setItem(this.key, JSON.stringify(filtered));
    return true;
  }

  query(filterFn: (item: T) => boolean): T[] {
    return this.getAll().filter(filterFn);
  }
}

// Database instances
export const db = {
  vehicles: new Database<Vehicle>(DB_KEYS.vehicles),
  drivers: new Database<Driver>(DB_KEYS.drivers),
  assignments: new Database<Assignment>(DB_KEYS.assignments),
  fuelLogs: new Database<FuelLog>(DB_KEYS.fuelLogs),
  maintenance: new Database<Maintenance>(DB_KEYS.maintenance),
  incidents: new Database<Incident>(DB_KEYS.incidents),
  trips: new Database<Trip>(DB_KEYS.trips),
  documents: new Database<Document>(DB_KEYS.documents),
  notifications: new Database<Notification>(DB_KEYS.notifications),
  users: new Database<User>(DB_KEYS.users),
};

// Current user management
export const auth = {
  getCurrentUser(): User | null {
    const data = localStorage.getItem(DB_KEYS.currentUser);
    return data ? JSON.parse(data) : null;
  },

  setCurrentUser(user: User | null): void {
    if (user) {
      localStorage.setItem(DB_KEYS.currentUser, JSON.stringify(user));
    } else {
      localStorage.removeItem(DB_KEYS.currentUser);
    }
  },

  login(email: string, _password: string): User | null {
    const users = db.users.getAll();
    const user = users.find((u) => u.email === email);
    if (user) {
      auth.setCurrentUser(user);
      return user;
    }
    return null;
  },

  logout(): void {
    localStorage.removeItem(DB_KEYS.currentUser);
  },
};

export function initializeSampleData() {
  // No-op. The app no longer ships with built-in sample records.
}

// Clear all data (for testing)
export function clearAllData() {
  Object.values(DB_KEYS).forEach((key) => localStorage.removeItem(key));
  localStorage.removeItem('lfz_fleet_initialized');
}
