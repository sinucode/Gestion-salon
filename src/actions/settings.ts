'use server'

import { createClient } from '@/lib/supabase/server'
import { ProfileUpdateSchema, PasswordUpdateSchema } from '@/lib/utils/validators'
import { revalidatePath } from 'next/cache'

export async function updateProfileInfo(formData: FormData) {
    try {
        const supabase = await createClient()

        // Verify session
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return { error: 'No autenticado' }
        }

        const rawData = {
            first_name: formData.get('first_name'),
            last_name: formData.get('last_name'),
            phone: formData.get('phone'),
            document_id: formData.get('document_id'),
        }

        const validatedFields = ProfileUpdateSchema.safeParse(rawData)

        if (!validatedFields.success) {
            return { error: 'Datos de perfil inválidos', details: validatedFields.error.flatten().fieldErrors }
        }

        const { error: updateError } = await supabase
            .from('profiles')
            .update({
                first_name: validatedFields.data.first_name,
                last_name: validatedFields.data.last_name,
                phone: validatedFields.data.phone || null,
                document_id: validatedFields.data.document_id || null,
            })
            .eq('id', user.id)

        if (updateError) {
            console.error('Update profile error:', updateError)
            return { error: 'Error al actualizar el perfil' }
        }

        // Update auth metadata to keep it in sync
        await supabase.auth.updateUser({
            data: {
                first_name: validatedFields.data.first_name,
                last_name: validatedFields.data.last_name,
            }
        })

        revalidatePath('/settings', 'layout')
        return { success: true }
    } catch (e) {
        console.error('Caught error updating profile:', e)
        return { error: 'Error inesperado' }
    }
}

export async function updateAccountPassword(formData: FormData) {
    try {
        const supabase = await createClient()

        // Allow Supabase to get the currently logged in user implicitly
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user || !user.email) {
            return { error: 'No autenticado' }
        }

        const rawData = {
            current_password: formData.get('current_password'),
            new_password: formData.get('new_password'),
            confirm_password: formData.get('confirm_password')
        }

        const validatedFields = PasswordUpdateSchema.safeParse(rawData)

        if (!validatedFields.success) {
            return { error: 'Datos inválidos', details: validatedFields.error.flatten().fieldErrors }
        }

        // Verify current password by attempting to sign in
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: validatedFields.data.current_password,
        })

        if (signInError) {
            return { error: 'La contraseña actual es incorrecta' }
        }

        // Update to new password
        const { error: updateError } = await supabase.auth.updateUser({
            password: validatedFields.data.new_password
        })

        if (updateError) {
            console.error('Password update error:', updateError)
            return { error: 'Error al cambiar la contraseña. ' + updateError.message }
        }

        return { success: true }

    } catch (e) {
        console.error('Caught error updating password:', e)
        return { error: 'Error inesperado' }
    }
}
