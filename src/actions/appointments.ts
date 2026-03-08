'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/rbac'
import { ROLES } from '@/lib/constants'

const ApproveSchema = z.object({
    appointmentId: z.string().uuid(),
})

/**
 * Approve a completed appointment.
 * This triggers inventory deduction, income + commission cash movements.
 * Only admin/super_admin can approve.
 */
export async function approveAppointment(input: z.infer<typeof ApproveSchema>) {
    const data = ApproveSchema.parse(input)
    const supabase = await createClient()
    const user = await requireRole(supabase, [ROLES.ADMIN, ROLES.SUPER_ADMIN])

    // Call the DB transaction function
    const { error } = await supabase.rpc('approve_appointment_tx', {
        p_appointment_id: data.appointmentId,
        p_approved_by: user.id,
    })

    if (error) throw new Error(error.message)

    revalidatePath('/appointments')
    revalidatePath('/inventory')
    revalidatePath('/finance')
    revalidatePath('/dashboard')
}

/**
 * Update appointment status (e.g., mark as completed by professional).
 */
export async function updateAppointmentStatus(
    appointmentId: string,
    status: 'in_progress' | 'completed' | 'cancelled' | 'no_show'
) {
    const supabase = await createClient()
    const user = await requireRole(supabase, [ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.PROFESSIONAL])

    // Validate current status transitions
    const { data: appt, error: fetchErr } = await supabase
        .from('appointments')
        .select('status, professional_id')
        .eq('id', appointmentId)
        .single()

    if (fetchErr || !appt) throw new Error('Cita no encontrada')

    // Professionals can only update their own appointments
    if (user.role === ROLES.PROFESSIONAL && appt.professional_id !== user.id) {
        throw new Error('Solo puede modificar sus propias citas')
    }

    // Valid transitions
    const validTransitions: Record<string, string[]> = {
        scheduled: ['in_progress', 'cancelled', 'no_show'],
        in_progress: ['completed', 'cancelled'],
    }

    const allowed = validTransitions[appt.status] || []
    if (!allowed.includes(status)) {
        throw new Error(`Transición inválida: ${appt.status} → ${status}`)
    }

    const { error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', appointmentId)

    if (error) throw new Error(error.message)

    // Audit log
    await supabase.from('audit_log').insert({
        user_id: user.id,
        table_name: 'appointments',
        record_id: appointmentId,
        action: 'UPDATE',
        old_values: { status: appt.status },
        new_values: { status },
    })

    revalidatePath('/appointments')
    revalidatePath('/dashboard')
}
