import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { AppSettings } from '@/types';

const SETTINGS_STORAGE_PREFIX = 'lfz_fleet_settings_';

export const defaultSettings: AppSettings = {
  emailNotifications: true,
  pushNotifications: true,
  maintenanceAlerts: true,
  fuelAlerts: true,
  incidentAlerts: true,
  documentAlerts: true,
  licenseAlerts: true,
  darkMode: false,
  compactView: false,
  currency: 'NGN',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24h',
  maintenanceReminderDays: '7',
  fuelEfficiencyUnit: 'L/100km',
};

function mergeSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object') {
    return { ...defaultSettings };
  }

  return {
    ...defaultSettings,
    ...(value as Partial<AppSettings>),
  };
}

function getStorageKey(userId: string) {
  return `${SETTINGS_STORAGE_PREFIX}${userId}`;
}

export async function getCurrentUserId(): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.user?.id ?? null;
}

export async function loadUserSettings(userId: string): Promise<AppSettings> {
  if (!isSupabaseConfigured || !supabase) {
    const stored = localStorage.getItem(getStorageKey(userId));
    return mergeSettings(stored ? JSON.parse(stored) : null);
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('settings')
      .eq('id', userId)
      .maybeSingle<{ settings: AppSettings | null }>();

    if (error) {
      throw error;
    }

    return mergeSettings(data?.settings ?? null);
  } catch (error) {
    console.error('Failed to load user settings, falling back to local storage.', error);
    const stored = localStorage.getItem(getStorageKey(userId));
    return mergeSettings(stored ? JSON.parse(stored) : null);
  }
}

export async function loadCurrentUserSettings(): Promise<AppSettings> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { ...defaultSettings };
  }

  return loadUserSettings(userId);
}

export async function saveUserSettings(
  userId: string,
  settings: AppSettings
): Promise<{ savedLocally: true; savedToBackend: boolean }> {
  localStorage.setItem(getStorageKey(userId), JSON.stringify(settings));

  if (!isSupabaseConfigured || !supabase) {
    return { savedLocally: true, savedToBackend: false };
  }

  try {
    const { error } = await supabase.from('profiles').update({ settings }).eq('id', userId);
    if (error) {
      throw error;
    }

    return { savedLocally: true, savedToBackend: true };
  } catch (error) {
    console.error('Failed to save user settings to Supabase, kept local fallback.', error);
    return { savedLocally: true, savedToBackend: false };
  }
}
