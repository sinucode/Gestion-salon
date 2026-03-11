'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ROLE_RANK: Record<string, number> = { super_admin: 4, admin: 3, professional: 2, client: 1 }

/**
 * Fetch emails from auth.users for a list of profile IDs.
 * Only admin+ can call this.
 */
export async function fetchUserEmails(userIds: string[]) {
    const supabase = await createClient()
    const { data: { user: caller } } = await supabase.auth.getUser()
    if (!caller) return { error: 'No autenticado' }

    const { data: callerProfile } = await supabase
        .from('profiles')
        .select('role, business_id')
        .eq('id', caller.id)
        .single()

    if (!callerProfile || !['super_admin', 'admin'].includes(callerProfile.role)) {
        return { error: 'Sin permisos' }
    }

    const admin = createAdminClient()
    const emailMap: Record<string, string> = {}

    // Fetch in batches to avoid overloading
    for (const uid of userIds) {
        const { data } = await admin.auth.admin.getUserById(uid)
        if (data?.user?.email) {
            emailMap[uid] = data.user.email
        }
    }

    return { data: emailMap }
}

/**
 * Admin/Super Admin: Update another user's email.
 */
export async function adminUpdateUserEmail(targetUserId: string, newEmail: string) {
    const supabase = await createClient()
    const { data: { user: caller } } = await supabase.auth.getUser()
    if (!caller) return { error: 'No autenticado' }

    // Get caller profile
    const { data: callerProfile } = await supabase
        .from('profiles')
        .select('role, business_id')
        .eq('id', caller.id)
        .single()

    if (!callerProfile || !['super_admin', 'admin'].includes(callerProfile.role)) {
        return { error: 'Sin permisos para modificar usuarios' }
    }

    // Get target profile
    const admin = createAdminClient()
    const { data: targetProfile } = await admin
        .from('profiles')
        .select('role, business_id')
        .eq('id', targetUserId)
        .single()

    if (!targetProfile) return { error: 'Usuario no encontrado' }

    // Enforce role hierarchy: cannot edit same or higher rank
    const callerRank = ROLE_RANK[callerProfile.role] || 0
    const targetRank = ROLE_RANK[targetProfile.role] || 0
    if (targetRank >= callerRank) {
        return { error: 'No tiene permisos para modificar este usuario' }
    }

    // Admin can only edit users in their own business
    if (callerProfile.role === 'admin' && targetProfile.business_id !== callerProfile.business_id) {
        return { error: 'No tiene permisos sobre usuarios de otro negocio' }
    }

    // Validate email format
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        return { error: 'Correo electrónico inválido' }
    }

    const { error } = await admin.auth.admin.updateUserById(targetUserId, {
        email: newEmail,
        email_confirm: true,
    })

    if (error) {
        console.error('Error updating user email:', error)
        return { error: 'Error al actualizar el email: ' + error.message }
    }

    return { success: true }
}

/**
 * Admin/Super Admin: Reset another user's password.
 */
export async function adminResetUserPassword(targetUserId: string, newPassword: string) {
    const supabase = await createClient()
    const { data: { user: caller } } = await supabase.auth.getUser()
    if (!caller) return { error: 'No autenticado' }

    // Get caller profile
    const { data: callerProfile } = await supabase
        .from('profiles')
        .select('role, business_id')
        .eq('id', caller.id)
        .single()

    if (!callerProfile || !['super_admin', 'admin'].includes(callerProfile.role)) {
        return { error: 'Sin permisos para modificar usuarios' }
    }

    // Get target profile
    const admin = createAdminClient()
    const { data: targetProfile } = await admin
        .from('profiles')
        .select('role, business_id')
        .eq('id', targetUserId)
        .single()

    if (!targetProfile) return { error: 'Usuario no encontrado' }

    // Enforce role hierarchy
    const callerRank = ROLE_RANK[callerProfile.role] || 0
    const targetRank = ROLE_RANK[targetProfile.role] || 0
    if (targetRank >= callerRank) {
        return { error: 'No tiene permisos para modificar este usuario' }
    }

    // Admin can only edit users in their own business
    if (callerProfile.role === 'admin' && targetProfile.business_id !== callerProfile.business_id) {
        return { error: 'No tiene permisos sobre usuarios de otro negocio' }
    }

    // Validate password
    if (!newPassword || newPassword.length < 8) {
        return { error: 'La contraseña debe tener al menos 8 caracteres' }
    }

    const { error } = await admin.auth.admin.updateUserById(targetUserId, {
        password: newPassword,
    })

    if (error) {
        console.error('Error resetting user password:', error)
        return { error: 'Error al cambiar la contraseña: ' + error.message }
    }

    return { success: true }
}
