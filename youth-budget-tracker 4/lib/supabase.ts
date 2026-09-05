import { createClient } from '@supabase/supabase-js'

// These two env vars live in .env.local (never commit that file).
// Find both under Supabase Dashboard -> Project Settings -> API.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
