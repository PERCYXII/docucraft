
import { createClient } from '@supabase/supabase-js';

/**
 * Supabase configuration.
 * URL is derived from the project ID: notugnacjjfaqatzzzgi
 * Anon Key is the verified JWT token provided for this project.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Export a flag so the UI can adapt to the configuration state
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Initialize client with provided or environment values
export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;
