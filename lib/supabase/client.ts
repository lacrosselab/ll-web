// lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr"

let supabase: ReturnType<typeof createBrowserClient> | null = null

export function getSupabaseClient() {
  if (!supabase) {
    supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, 
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          // Use a consistent storage key
          storageKey: `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0]}-auth-token`,
          // Ensure proper storage handling
          storage: {
            getItem: (key: string) => {
              try {
                if (typeof window !== 'undefined') {
                  return localStorage.getItem(key)
                }
                return null
              } catch {
                return null
              }
            },
            setItem: (key: string, value: string) => {
              try {
                if (typeof window !== 'undefined') {
                  localStorage.setItem(key, value)
                }
              } catch {
                // Ignore storage errors
              }
            },
            removeItem: (key: string) => {
              try {
                if (typeof window !== 'undefined') {
                  localStorage.removeItem(key)
                }
              } catch {
                // Ignore storage errors
              }
            }
          }
        }
      }
    )
  }
  return supabase
}

// Add a function to clear the client instance (useful for testing)
export function clearSupabaseClient() {
  supabase = null
}