import { createClient } from '@supabase/supabase-js'

// Public client for browser use. Safe to expose anon key.
const SUPABASE_URL = 'https://yzflpnovjxmovgngcevr.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6Zmxwbm92anhtb3ZnbmdjZXZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1ODQzMTUsImV4cCI6MjA3MTE2MDMxNX0._BivcXJd3eK0zD4oowMTQcNZxkOH4re8Mb1oLSljnBI'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)


