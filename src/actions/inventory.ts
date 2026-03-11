'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/rbac'
import { ROLES } from '@/lib/constants'

// ============================================
// DEACTIVATION CRUD (Logical Deletes)
// ============================================

export async function delete_product(id: string) {
    const supabase = await createClient()
    await requireRole(supabase, [ROLES.SUPER_ADMIN, ROLES.ADMIN])
    const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id)
    if (error) throw new Error(error.message)
    revalidatePath('/inventory')
    return { success: true }
}

export async function restore_product(id: string) {
    const supabase = await createClient()
    await requireRole(supabase, [ROLES.SUPER_ADMIN, ROLES.ADMIN])
    const { error } = await supabase.from('products').update({ is_active: true }).eq('id', id)
    if (error) throw new Error(error.message)
    revalidatePath('/inventory')
    return { success: true }
}
