
import { createClient } from '@supabase/supabase-js';

// Prioritize variables from process.env (defined in vite.config.ts)
const supabaseUrl = process.env.SUPABASE_URL || 'https://notugnacjjfaqatzzzgi.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vdHVnbmFjampmYXFhdHp6emdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5MjczMTksImV4cCI6MjA4MTUwMzMxOX0.zTra57mZCZbSctpW5WjJv6XL3XCRhkXe0PD6FfR2JtY';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;
