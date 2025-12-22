
import { createClient } from '@supabase/supabase-js';

// Prioritize variables from process.env (defined in vite.config.ts)
const supabaseUrl = process.env.SUPABASE_URL || 'https://notugnacjjfaqatzzzgi.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;
