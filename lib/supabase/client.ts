import { createBrowserClient } from "@supabase/ssr"

let supabase: ReturnType<typeof createBrowserClient> | null = null

// In lib/supabase/client.ts
export function getSupabaseClient() {
  if (!supabase) {
    supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, 
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! // Changed from ANON_KEY
    )
  }
  return supabase
}