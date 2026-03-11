'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/rbac'
import { ROLES } from '@/lib/constants'

// ============================================
// DIRECT SALE (Venta Directa)
// ============================================
export async function process_direct_sale(input: {
    business_id: string;
    location_id: string;
    cash_register_id: string;
    account_id: string;
    items: { product_id: string; qty: number; price: number }[];
    total: number;
    client_name?: string;
}) {
    const supabase = await createClient()
    await requireRole(supabase, [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PROFESSIONAL])
    
    // Check if register is open
    const { data: reg } = await supabase.from('cash_registers').select('status').eq('id', input.cash_register_id).single()
    if (!reg || reg.status !== 'open') throw new Error('La caja debe estar abierta para facturar.')

    // 1. Create cash movement
    const { data: mov, error: errMov } = await supabase.from('cash_movements').insert({
        business_id: input.business_id,
        location_id: input.location_id,
        cash_register_id: input.cash_register_id,
        account_id: input.account_id,
        type: 'direct_sale',
        amount: input.total,
        description: `Venta Directa POS: ${input.client_name || 'Cliente Express'}`
    }).select().single()

    if (errMov) throw new Error(errMov.message)

    // 2. Reduce Stock
    for (const item of input.items) {
        // Find product
        const { data: prod } = await supabase.from('products').select('stock_qty, name').eq('id', item.product_id).single()
        if (prod) {
            // Un stock movement
            await supabase.from('stock_movements').insert({
                business_id: input.business_id,
                location_id: input.location_id,
                product_id: item.product_id,
                type: 'consumption',
                qty_change: -item.qty,
                reason: `Venta Directa POS (Ref: ${mov.id})`
            })
            // Actualizar stock master
            await supabase.from('products').update({
                stock_qty: prod.stock_qty - item.qty
            }).eq('id', item.product_id)
        }
    }

    revalidatePath('/pos')
    revalidatePath('/inventory')
    revalidatePath('/finance')

    return { success: true, movement_id: mov.id }
}

// ============================================
// EXPRESS APPOINTMENT (Cita Express POS)
// ============================================
export async function create_express_appointment(input: {
    business_id: string;
    location_id: string;
    professional_id: string;
    client_name: string;
    service_ids: string[];
    total: number;
}) {
    const supabase = await createClient()
    await requireRole(supabase, [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PROFESSIONAL])

    // Find professional for calculation duration
    // Actually we just fetch duration from services
    const { data: services } = await supabase.from('services').select('id, duration_min, price').in('id', input.service_ids)
    const duration = services?.reduce((acc, s) => acc + s.duration_min, 0) || 30

    // Creates generic appointment
    const starts_at = new Date().toISOString()
    const ends_at = new Date(Date.now() + duration * 60000).toISOString()

    const { data: appt, error } = await supabase.from('appointments').insert({
        business_id: input.business_id,
        location_id: input.location_id,
        professional_id: input.professional_id,
        client_id: null, // No registered client
        status: 'scheduled',
        starts_at,
        ends_at,
        total_price: input.total,
        notes: `Cita Express: ${input.client_name}`
    }).select().single()

    if (error) throw new Error(error.message)

    // Append services
    const appt_services = input.service_ids.map(sid => ({
        appointment_id: appt.id,
        service_id: sid
    }))

    await supabase.from('appointment_services').insert(appt_services)

    revalidatePath('/appointments')
    revalidatePath('/pos')

    return { success: true, appointment: appt }
}
