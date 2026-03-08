import { createClient } from '@supabase/supabase-js'

/**
 * Admin client using service_role key.
 * NEVER use this on the client side.
 * This bypasses RLS — use only for server-side admin operations.
 */
export function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    )
}
