import { createClient } from '@supabase/supabase-js'

// These two env vars live in .env.local (never commit that file).
// Find both under Supabase Dashboard -> Project Settings -> API.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// The receipts bucket is private — receipt_url in the database stores
// a file PATH, not a working link. Call this wherever a receipt needs
// to actually be displayed (e.g. the supervisor approval screen) to
// get a temporary link that expires after `expiresInSeconds`.
export async function getReceiptSignedUrl(path: string, expiresInSeconds = 60) {
  const { data, error } = await supabase.storage
    .from('receipts')
    .createSignedUrl(path, expiresInSeconds)

  if (error) throw error
  return data.signedUrl
}
