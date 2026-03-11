'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/rbac'
import { ROLES } from '@/lib/constants'
import { BusinessSchema, LocationSchema } from '@/lib/utils/validators'

// ============================================
// BUSINESS CRUD
// ============================================
export async function createBusiness(input: z.infer<typeof BusinessSchema>) {
    const data = BusinessSchema.parse(input)
    const supabase = await createClient()
    await requireRole(supabase, [ROLES.SUPER_ADMIN])

    const { data: business, error } = await supabase
        .from('businesses')
        .insert(data)
        .select()
        .single()

    if (error) throw new Error(error.message)

    // Log audit
    await supabase.from('audit_log').insert({
        user_id: (await supabase.auth.getUser()).data.user!.id,
        business_id: business.id,
        table_name: 'businesses',
        record_id: business.id,
        action: 'INSERT',
        new_values: business,
    })

    revalidatePath('/super-admin/businesses')
    return business
}

export async function updateBusiness(id: string, input: Partial<z.infer<typeof BusinessSchema>>) {
    const supabase = await createClient()
    await requireRole(supabase, [ROLES.SUPER_ADMIN])

    const { data: oldBusiness } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', id)
        .single()

    const { data: business, error } = await supabase
        .from('businesses')
        .update(input)
        .eq('id', id)
        .select()
        .single()

    if (error) throw new Error(error.message)

    await supabase.from('audit_log').insert({
        user_id: (await supabase.auth.getUser()).data.user!.id,
        business_id: business.id,
        table_name: 'businesses',
        record_id: business.id,
        action: 'UPDATE',
        old_values: oldBusiness,
        new_values: business,
    })

    revalidatePath('/super-admin/businesses')
    return business
}

// ============================================
// LOCATION CRUD
// ============================================
export async function createLocation(input: z.infer<typeof LocationSchema>) {
    const data = LocationSchema.parse(input)
    const supabase = await createClient()
    await requireRole(supabase, [ROLES.SUPER_ADMIN, ROLES.ADMIN])

    const { data: location, error } = await supabase
        .from('locations')
        .insert(data)
        .select()
        .single()

    if (error) throw new Error(error.message)

    await supabase.from('audit_log').insert({
        user_id: (await supabase.auth.getUser()).data.user!.id,
        business_id: data.business_id,
        table_name: 'locations',
        record_id: location.id,
        action: 'INSERT',
        new_values: location,
    })

    revalidatePath('/admin/locations')
    return location
}

export async function updateLocation(id: string, input: Partial<z.infer<typeof LocationSchema>>) {
    const supabase = await createClient()
    await requireRole(supabase, [ROLES.SUPER_ADMIN, ROLES.ADMIN])

    const { data: oldLocation } = await supabase
        .from('locations')
        .select('*')
        .eq('id', id)
        .single()

    const { data: location, error } = await supabase
        .from('locations')
        .update(input)
        .eq('id', id)
        .select()
        .single()

    if (error) throw new Error(error.message)

    await supabase.from('audit_log').insert({
        user_id: (await supabase.auth.getUser()).data.user!.id,
        business_id: location.business_id,
        table_name: 'locations',
        record_id: location.id,
        action: 'UPDATE',
        old_values: oldLocation,
        new_values: location,
    })

    revalidatePath('/admin/locations')
    return location
}

// ============================================
// DEACTIVATION CRUD (Logical Deletes)
// ============================================

export async function delete_business(id: string) {
    const supabase = await createClient()
    await requireRole(supabase, [ROLES.SUPER_ADMIN])
    const { error } = await supabase.from('businesses').update({ is_active: false }).eq('id', id)
    if (error) throw new Error(error.message)
    revalidatePath('/super-admin/businesses')
    return { success: true }
}

export async function restore_business(id: string) {
    const supabase = await createClient()
    await requireRole(supabase, [ROLES.SUPER_ADMIN])
    const { error } = await supabase.from('businesses').update({ is_active: true }).eq('id', id)
    if (error) throw new Error(error.message)
    revalidatePath('/super-admin/businesses')
    return { success: true }
}

export async function delete_location(id: string) {
    const supabase = await createClient()
    await requireRole(supabase, [ROLES.SUPER_ADMIN, ROLES.ADMIN])
    const { error } = await supabase.from('locations').update({ is_active: false }).eq('id', id)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/locations')
    return { success: true }
}

export async function restore_location(id: string) {
    const supabase = await createClient()
    await requireRole(supabase, [ROLES.SUPER_ADMIN, ROLES.ADMIN])
    const { error } = await supabase.from('locations').update({ is_active: true }).eq('id', id)
    if (error) throw new Error(error.message)
    revalidatePath('/admin/locations')
    return { success: true }
}
