'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/rbac'
import { ROLES } from '@/lib/constants'

// ============================================
// ACCOUNTS CRUD
// ============================================
export async function create_account(input: { business_id: string; location_id: string; name: string; type: string }) {
    const supabase = await createClient()
    await requireRole(supabase, [ROLES.SUPER_ADMIN, ROLES.ADMIN])

    const { data, error } = await supabase.from('accounts').insert(input).select().single()
    if (error) throw new Error(error.message)
    
    revalidatePath('/finance')
    return data
}

export async function transfer_funds(input: {
    from_account_id: string;
    to_account_id: string;
    amount: number;
    description: string;
    business_id: string;
    location_id: string;
    cash_register_id: string;
}) {
    const supabase = await createClient()
    await requireRole(supabase, [ROLES.SUPER_ADMIN, ROLES.ADMIN])

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('No user data')

    const { data, error } = await supabase.rpc('transfer_funds', {
        p_from_acc: input.from_account_id,
        p_to_acc: input.to_account_id,
        p_amount: input.amount,
        p_desc: input.description,
        p_user: user.id,
        p_busi: input.business_id,
        p_loc: input.location_id,
        p_reg: input.cash_register_id
    })

    if (error) throw new Error(error.message)
    revalidatePath('/finance')
    return { success: true, transfer_id: data }
}

// ============================================
// CASH REGISTERS (Cierres de Caja)
// ============================================
export async function open_cash_register(input: { business_id: string; location_id: string; base_amount: number }) {
    const supabase = await createClient()
    await requireRole(supabase, [ROLES.SUPER_ADMIN, ROLES.ADMIN])
    const { data: { user } } = await supabase.auth.getUser()

    // Ensure there is no active cash register
    const { data: active } = await supabase
        .from('cash_registers')
        .select('id')
        .eq('status', 'open')
        .eq('location_id', input.location_id)
        .single()

    if (active) throw new Error('Ya existe una caja abierta en esta sede.')

    const { data, error } = await supabase.from('cash_registers').insert({
        business_id: input.business_id,
        location_id: input.location_id,
        opened_by: user!.id,
        base_amount: input.base_amount,
        status: 'open'
    }).select().single()

    if (error) throw new Error(error.message)
    
    // Create an opening balance cash movement if base > 0 (optional based on business rule)
    if (input.base_amount > 0) {
        // We need a default account. Find the first cash account.
        const { data: acc } = await supabase.from('accounts').select('id').eq('type', 'cash').eq('location_id', input.location_id).limit(1)
        if (acc && acc.length > 0) {
            await supabase.from('cash_movements').insert({
                business_id: input.business_id,
                location_id: input.location_id,
                account_id: acc[0].id,
                cash_register_id: data.id,
                type: 'opening_balance',
                amount: input.base_amount,
                description: 'Apertura de caja - Base base',
            })
        }
    }

    revalidatePath('/finance')
    return data
}

export async function close_cash_register(id: string, final_amount: number, notes: string | null) {
    const supabase = await createClient()
    await requireRole(supabase, [ROLES.SUPER_ADMIN, ROLES.ADMIN])
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase.from('cash_registers').update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        closed_by: user!.id,
        final_amount,
        notes
    }).eq('id', id).select().single()

    if (error) throw new Error(error.message)
    revalidatePath('/finance')
    return data
}

// ============================================
// PAYOUTS (Liquidación a Demanda)
// ============================================
export async function process_payout(input: {
    business_id: string;
    location_id: string;
    professional_id: string;
    account_id: string;
    amount: number;
    cash_register_id: string;
}) {
    const supabase = await createClient()
    await requireRole(supabase, [ROLES.SUPER_ADMIN, ROLES.ADMIN])
    const { data: { user } } = await supabase.auth.getUser()

    // 1. Move money out of account
    const { data: movement, error: movError } = await supabase.from('cash_movements').insert({
        business_id: input.business_id,
        location_id: input.location_id,
        account_id: input.account_id,
        cash_register_id: input.cash_register_id,
        professional_id: input.professional_id,
        type: 'payout',
        amount: input.amount,
        description: 'Pago a profesional (Liquidación)'
    }).select().single()

    if (movError) throw new Error(movError.message)

    // 2. Register Payout
    const { error: payoutError } = await supabase.from('payouts').insert({
        business_id: input.business_id,
        location_id: input.location_id,
        professional_id: input.professional_id,
        account_id: input.account_id,
        amount: input.amount,
        cash_movement_id: movement.id,
        created_by: user!.id
    })

    if (payoutError) throw new Error(payoutError.message)
    
    revalidatePath('/finance')
    return { success: true }
}
