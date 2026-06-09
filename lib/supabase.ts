import { createClient } from "@supabase/supabase-js"

// Fallback placeholder agar createClient tidak throw saat prerender build
// tanpa env (Supabase memvalidasi URL di constructor). Saat runtime di
// browser/server dengan env nyata, nilai asli yang dipakai.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key"

// Used ONLY for Realtime subscriptions (kitchen display, stock alerts).
// All CRUD operations go through Prisma via API routes.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
