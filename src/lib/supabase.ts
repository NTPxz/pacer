import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Both values are public by design (the anon key only grants what Row Level Security allows).
// Without them the app runs in guest-only mode.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
      })
    : null

export const PHOTO_BUCKET = 'race-photos'
