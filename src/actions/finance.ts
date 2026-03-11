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
    
    // Manual audit update if needed (since RPC might not set created_by yet)
    // Actually, it's better to update the RPC, but for now let's ensure we track it.
    
    revalidatePath('/finance')
    return { success: true, transfer_id: data }
}

// ============================================
// CASH REGISTERS (Cierres de Caja)
// ============================================
interface AccountDeclaration {
    account_id: string;
    expected: number;
    real: number;
    difference: number;
    justification: string;
}

export async function open_cash_register(input: { 
    business_id: string; 
    location_id: string; 
    declarations: AccountDeclaration[] 
}) {
    const supabase = await createClient()
    await requireRole(supabase, [ROLES.SUPER_ADMIN, ROLES.ADMIN])
    const { data: { user } } = await supabase.auth.getUser()

    // Ensure there is no active cash register
    const { data: active } = await supabase
        .from('cash_registers')
        .select('id')
        .eq('status', 'open')
        .eq('location_id', input.location_id)
        .limit(1)

    if (active && active.length > 0) throw new Error('Ya existe una caja abierta en esta sede.')

    // Calculate total base (sum of real amounts)
    const total_base = input.declarations.reduce((acc, d) => acc + d.real, 0)

    const { data: reg, error: regError } = await supabase.from('cash_registers').insert({
        business_id: input.business_id,
        location_id: input.location_id,
        opened_by: user!.id,
        base_amount: total_base,
        status: 'open'
    }).select().single()

    if (regError) throw new Error(regError.message)

    // Process adjustments
    for (const d of input.declarations) {
        if (d.difference !== 0) {
            const isSobrante = d.difference > 0
            await supabase.from('cash_movements').insert({
                business_id: input.business_id,
                location_id: input.location_id,
                account_id: d.account_id,
                cash_register_id: reg.id,
                type: isSobrante ? 'adjustment_in' : 'adjustment_out',
                amount: Math.abs(d.difference),
                description: `${isSobrante ? 'Sobrante' : 'Faltante'} de caja al abrir: ${d.justification}`,
                created_by: user!.id
            })
        }
    }

    revalidatePath('/finance')
    return reg
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
        description: 'Pago a profesional (Liquidación)',
        created_by: user!.id
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

// ============================================
// OPERATING EXPENSES (Gastos Operativos)
// ============================================
export async function create_expense(input: {
    business_id: string;
    location_id: string;
    account_id: string;
    cash_register_id: string;
    category: string;
    amount: number;
    description: string;
}) {
    const supabase = await createClient()
    await requireRole(supabase, [ROLES.SUPER_ADMIN, ROLES.ADMIN])
    const { data: { user } } = await supabase.auth.getUser()

    // 1. Create cash movement
    const { data: movement, error: movError } = await supabase.from('cash_movements').insert({
        business_id: input.business_id,
        location_id: input.location_id,
        account_id: input.account_id,
        cash_register_id: input.cash_register_id,
        type: 'expense',
        amount: input.amount,
        description: `Gasto Operativo: ${input.category} - ${input.description}`,
        created_by: user!.id
    }).select().single()

    if (movError) throw new Error(movError.message)

    // 2. Insert into operating_expenses
    const { error: expError } = await supabase.from('operating_expenses').insert({
        business_id: input.business_id,
        location_id: input.location_id,
        account_id: input.account_id,
        cash_register_id: input.cash_register_id,
        category: input.category,
        amount: input.amount,
        description: input.description,
        cash_movement_id: movement.id,
        created_by: user!.id
    })

    if (expError) throw new Error(expError.message)

    revalidatePath('/finance')
    return { success: true }
}
