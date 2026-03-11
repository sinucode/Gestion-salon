'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ROLE_RANK: Record<string, number> = { super_admin: 4, admin: 3, professional: 2, client: 1 }

// ============================================
// Roles the caller is allowed to see
// ============================================
function allowed_target_roles(caller_role: string): string[] {
    switch (caller_role) {
        case 'super_admin': return ['super_admin', 'admin', 'professional', 'client']
        case 'admin':       return ['professional', 'client']
        case 'professional': return ['client']
        default:            return []   // client sees nobody via this action
    }
}

// ============================================
// List Users — server-side filtered
// ============================================
export interface ProfileListRow {
    id: string
    first_name: string
    last_name: string
    email?: string
    role: string
    phone: string | null
    document_id: string | null
    is_active: boolean
    business_id: string | null
    location_id: string | null
    location_name?: string
    assigned_locations?: string[]
}

/**
 * Fetch the list of users visible to the caller.
 * Applies strict lateral-block rules at the server level so
 * peers are NEVER sent to the browser.
 *
 * @param filter_business_id  optional business filter (super_admin switching context)
 */
export async function list_users_filtered(
    filter_business_id?: string | null,
): Promise<{ data?: ProfileListRow[]; error?: string }> {
    const supabase = await createClient()
    const { data: { user: caller } } = await supabase.auth.getUser()
    if (!caller) return { error: 'No autenticado' }

    const { data: caller_profile } = await supabase
        .from('profiles')
        .select('role, business_id')
        .eq('id', caller.id)
        .single()

    if (!caller_profile) return { error: 'Perfil no encontrado' }

    const caller_role = caller_profile.role as string
    const caller_business_id = caller_profile.business_id as string | null

    // Client sees nothing through this endpoint
    if (caller_role === 'client') return { data: [] }

    const target_roles = allowed_target_roles(caller_role)
    if (target_roles.length === 0) return { data: [] }

    // Use admin client to bypass RLS so we control the filter ourselves
    const admin = createAdminClient()

    let query = admin
        .from('profiles')
        .select('id, first_name, last_name, role, phone, document_id, is_active, business_id, location_id, assigned_locations, location:locations(name)')
        .in('role', target_roles)
        .order('first_name')

    // Scope by business
    if (caller_role === 'super_admin') {
        // Super admin: optionally filter by a selected business
        if (filter_business_id) {
            query = query.eq('business_id', filter_business_id)
        }
    } else {
        // Admin / professional: always scoped to own business
        if (caller_business_id) {
            query = query.eq('business_id', caller_business_id)
        }
    }

    const { data, error } = await query

    if (error) {
        console.error('list_users_filtered error:', error)
        return { error: 'Error al obtener usuarios' }
    }

    // Append the caller's own profile at the top (always visible to self)
    const { data: self_profile } = await admin
        .from('profiles')
        .select('id, first_name, last_name, role, phone, document_id, is_active, business_id, location_id, assigned_locations, location:locations(name)')
        .eq('id', caller.id)
        .single()

    const profiles = (data as any[] || []).map(p => ({
        ...p,
        location_name: p.location?.name
    })) as ProfileListRow[]

    // If the caller is not already in the list (e.g. admin not seeing other admins),
    // prepend them
    if (self_profile && !profiles.find(p => p.id === self_profile.id)) {
        profiles.unshift({
            ...self_profile,
            location_name: (self_profile as any).location?.name
        } as ProfileListRow)
    }

    return { data: profiles }
}

// ============================================
// Fetch User Emails — server-side only
// ============================================
/**
 * Fetch emails from auth.users for a list of profile IDs.
 * Only admin+ can call this. Returns ONLY emails for users
 * the caller is allowed to see.
 */
export async function fetch_user_emails(user_ids: string[]) {
    const supabase = await createClient()
    const { data: { user: caller } } = await supabase.auth.getUser()
    if (!caller) return { error: 'No autenticado' }

    const { data: caller_profile } = await supabase
        .from('profiles')
        .select('role, business_id')
        .eq('id', caller.id)
        .single()

    if (!caller_profile || !['super_admin', 'admin'].includes(caller_profile.role)) {
        return { error: 'Sin permisos' }
    }

    // Verify each target is within permitted roles
    const admin = createAdminClient()
    const target_roles = allowed_target_roles(caller_profile.role)

    const { data: allowed_profiles } = await admin
        .from('profiles')
        .select('id, role, business_id')
        .in('id', user_ids)
        .in('role', target_roles)

    const allowed_ids = new Set(
        (allowed_profiles ?? [])
            .filter(p => {
                // Super admin sees all
                if (caller_profile.role === 'super_admin') return true
                // Others only see same business
                return p.business_id === caller_profile.business_id
            })
            .map(p => p.id)
    )

    // Always allow own email
    allowed_ids.add(caller.id)

    const email_map: Record<string, string> = {}
    for (const uid of user_ids) {
        if (!allowed_ids.has(uid)) continue
        const { data } = await admin.auth.admin.getUserById(uid)
        if (data?.user?.email) {
            email_map[uid] = data.user.email
        }
    }

    return { data: email_map }
}

// ============================================
// Admin: Update User Email
// ============================================
export async function admin_update_user_email(target_user_id: string, new_email: string) {
    const supabase = await createClient()
    const { data: { user: caller } } = await supabase.auth.getUser()
    if (!caller) return { error: 'No autenticado' }

    const { data: caller_profile } = await supabase
        .from('profiles')
        .select('role, business_id')
        .eq('id', caller.id)
        .single()

    if (!caller_profile || !['super_admin', 'admin'].includes(caller_profile.role)) {
        return { error: 'Sin permisos para modificar usuarios' }
    }

    const admin = createAdminClient()
    const { data: target_profile } = await admin
        .from('profiles')
        .select('role, business_id')
        .eq('id', target_user_id)
        .single()

    if (!target_profile) return { error: 'Usuario no encontrado' }

    // Enforce role hierarchy: cannot edit same or higher rank
    const caller_rank = ROLE_RANK[caller_profile.role] || 0
    const target_rank = ROLE_RANK[target_profile.role] || 0
    if (target_rank >= caller_rank) {
        return { error: 'No tiene permisos para modificar este usuario' }
    }

    // Admin scoped to own business
    if (caller_profile.role === 'admin' && target_profile.business_id !== caller_profile.business_id) {
        return { error: 'No tiene permisos sobre usuarios de otro negocio' }
    }

    if (!new_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(new_email)) {
        return { error: 'Correo electrónico inválido' }
    }

    const { error } = await admin.auth.admin.updateUserById(target_user_id, {
        email: new_email,
        email_confirm: true,
    })

    if (error) {
        console.error('Error updating user email:', error)
        return { error: 'Error al actualizar el email: ' + error.message }
    }

    return { success: true }
}

// ============================================
// Admin: Reset User Password
// ============================================
export async function admin_reset_user_password(target_user_id: string, new_password: string) {
    const supabase = await createClient()
    const { data: { user: caller } } = await supabase.auth.getUser()
    if (!caller) return { error: 'No autenticado' }

    const { data: caller_profile } = await supabase
        .from('profiles')
        .select('role, business_id')
        .eq('id', caller.id)
        .single()

    if (!caller_profile || !['super_admin', 'admin'].includes(caller_profile.role)) {
        return { error: 'Sin permisos para modificar usuarios' }
    }

    const admin = createAdminClient()
    const { data: target_profile } = await admin
        .from('profiles')
        .select('role, business_id')
        .eq('id', target_user_id)
        .single()

    if (!target_profile) return { error: 'Usuario no encontrado' }

    const caller_rank = ROLE_RANK[caller_profile.role] || 0
    const target_rank = ROLE_RANK[target_profile.role] || 0
    if (target_rank >= caller_rank) {
        return { error: 'No tiene permisos para modificar este usuario' }
    }

    if (caller_profile.role === 'admin' && target_profile.business_id !== caller_profile.business_id) {
        return { error: 'No tiene permisos sobre usuarios de otro negocio' }
    }

    if (!new_password || new_password.length < 8) {
        return { error: 'La contraseña debe tener al menos 8 caracteres' }
    }

    const { error } = await admin.auth.admin.updateUserById(target_user_id, {
        password: new_password,
    })

    if (error) {
        console.error('Error resetting user password:', error)
        return { error: 'Error al cambiar la contraseña: ' + error.message }
    }

    return { success: true }
}

// ============================================
// Admin: Update Profile Info
// ============================================
export async function admin_update_profile(
    target_user_id: string,
    data: {
        first_name: string
        last_name: string
        phone?: string | null
        document_id?: string | null
        role: string
        is_active: boolean
        location_id?: string | null
        assigned_locations?: string[]
    },
) {
    const supabase = await createClient()
    const { data: { user: caller } } = await supabase.auth.getUser()
    if (!caller) return { error: 'No autenticado' }

    const { data: caller_profile } = await supabase
        .from('profiles')
        .select('role, business_id')
        .eq('id', caller.id)
        .single()

    if (!caller_profile) return { error: 'Perfil no encontrado' }

    const admin_client = createAdminClient()
    const { data: target_profile } = await admin_client
        .from('profiles')
        .select('role, business_id')
        .eq('id', target_user_id)
        .single()

    if (!target_profile) return { error: 'Usuario no encontrado' }

    // Self-edit is always allowed
    if (target_user_id !== caller.id) {
        const caller_rank = ROLE_RANK[caller_profile.role] || 0
        const target_rank = ROLE_RANK[target_profile.role] || 0
        if (target_rank >= caller_rank) {
            return { error: 'No tiene permisos para modificar este usuario' }
        }
        if (caller_profile.role === 'admin' && target_profile.business_id !== caller_profile.business_id) {
            return { error: 'No tiene permisos sobre usuarios de otro negocio' }
        }
    }

    const { error } = await admin_client
        .from('profiles')
        .update({
            first_name: data.first_name,
            last_name: data.last_name,
            phone: data.phone || null,
            document_id: data.document_id || null,
            role: data.role,
            is_active: data.is_active,
            location_id: data.location_id || null,
            assigned_locations: data.assigned_locations || [],
        })
        .eq('id', target_user_id)

    if (error) {
        console.error('Error updating profile:', error)
        return { error: 'Error al actualizar el perfil: ' + error.message }
    }

    return { success: true }
}
