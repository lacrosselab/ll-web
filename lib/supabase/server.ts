import { createServerClient as createSupabaseServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function getSupabaseServer() {
  const cookieStore = await cookies()

  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, 
    process.env.SUPABASE_SECRET_KEY!, 
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

export function createServerClient() {
  return getSupabaseServer()
}
