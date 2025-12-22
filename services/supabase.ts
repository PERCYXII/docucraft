
import { createClient } from '@supabase/supabase-js';

// Use Vite envs and normalize scheme to lowercase ('http'/'https')
const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://notugnacjjfaqatzzzgi.supabase.co';
const supabaseUrl = rawSupabaseUrl.replace(/^[^:]+:\/\//, (m) => m.toLowerCase());
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;
