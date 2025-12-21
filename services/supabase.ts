
import { createClient } from '@supabase/supabase-js';

/**
 * Supabase configuration.
 * URL is derived from the project ID: notugnacjjfaqatzzzgi
 * Anon Key is the verified JWT token provided for this project.
 */
const supabaseUrl = (process.env as any).SUPABASE_URL || 'https://notugnacjjfaqatzzzgi.supabase.co';
const supabaseAnonKey = (process.env as any).SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vdHVnbmFjampmYXFhdHp6emdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5MjczMTksImV4cCI6MjA4MTUwMzMxOX0.zTra57mZCZbSctpW5WjJv6XL3XCRhkXe0PD6FfR2JtY';

// Export a flag so the UI can adapt to the configuration state
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Initialize client with provided or environment values
export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;
