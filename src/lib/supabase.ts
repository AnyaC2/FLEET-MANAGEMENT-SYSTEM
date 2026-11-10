import { createClient } from '@supabase/supabase-js';

const configuredSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseUrl =
  import.meta.env.DEV && configuredSupabaseUrl
    ? `${window.location.origin}/supabase-proxy`
    : configuredSupabaseUrl;

export const isSupabaseConfigured = Boolean(configuredSupabaseUrl && supabaseAnonKey);
export { supabaseUrl, supabaseAnonKey };

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
