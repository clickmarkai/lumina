import { createClient } from '@supabase/supabase-js'

// Public client for browser use. Safe to expose anon key.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing required environment variables: VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(SUPABASE_URL || '', SUPABASE_ANON_KEY || '')


