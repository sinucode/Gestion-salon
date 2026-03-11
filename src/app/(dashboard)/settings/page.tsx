'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { User, Lock, Save, Loader2, Sun, Moon, Monitor } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ProfileUpdateSchema, PasswordUpdateSchema } from '@/lib/utils/validators'
import { updateProfileInfo, updateAccountPassword } from '@/actions/settings'
import { useAuthStore } from '@/stores'
import { toast } from 'sonner'
import * as z from 'zod'
import { useTheme } from 'next-themes'
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'

export default function SettingsPage() {
    const { user, setUser } = useAuthStore()
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)
    const [isProfilePending, setIsProfilePending] = useState(false)
    const [isPasswordPending, setIsPasswordPending] = useState(false)

    // Form 1: Profile
    const profileForm = useForm<z.infer<typeof ProfileUpdateSchema>>({
        resolver: zodResolver(ProfileUpdateSchema),
        defaultValues: {
            first_name: '',
            last_name: '',
            phone: '',
            document_id: '',
        },
    })

    // Populate profile form when user data loads
    useEffect(() => {
        setMounted(true)
        if (user) {
            profileForm.reset({
                first_name: user.first_name || '',
                last_name: user.last_name || '',
                phone: user.phone || '',
                document_id: user.document_id || '',
            })
        }
    }, [user, profileForm])

    // Form 2: Password
    const passwordForm = useForm<z.infer<typeof PasswordUpdateSchema>>({
        resolver: zodResolver(PasswordUpdateSchema),
        defaultValues: {
            current_password: '',
            new_password: '',
            confirm_password: '',
        },
    })

    const onProfileSubmit = async (values: z.infer<typeof ProfileUpdateSchema>) => {
        setIsProfilePending(true)
        const formData = new FormData()
        Object.entries(values).forEach(([key, val]) => {
            formData.append(key, val as string)
        })

        const res = await updateProfileInfo(formData)
        if (res?.error) {
            toast.error(res.error)
        } else {
            toast.success('Perfil actualizado correctamente')
            // Update local store
            if (user) {
                setUser({
                    ...user,
                    first_name: values.first_name,
                    last_name: values.last_name,
                    phone: values.phone || null,
                    document_id: values.document_id || null,
                })
            }
        }
        setIsProfilePending(false)
    }

    const onPasswordSubmit = async (values: z.infer<typeof PasswordUpdateSchema>) => {
        setIsPasswordPending(true)
        const formData = new FormData()
        formData.append('current_password', values.current_password)
        formData.append('new_password', values.new_password)
        formData.append('confirm_password', values.confirm_password)

        const res = await updateAccountPassword(formData)
        if (res?.error) {
            toast.error(res.error)
        } else {
            toast.success('Contraseña actualizada correctamente')
            passwordForm.reset()
        }
        setIsPasswordPending(false)
    }

    return (
        <div className="space-y-6 max-w-4xl">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
                <p className="text-muted-foreground">Administra tu información personal y seguridad</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Profile Information Card */}
                <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <User className="w-5 h-5 text-brand" />
                            Información Personal
                        </CardTitle>
                        <CardDescription>
                            Actualiza tus datos básicos. Solo tú puedes editar esta información.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...profileForm}>
                            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={profileForm.control}
                                        name="first_name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Nombre</FormLabel>
                                                <FormControl>
                                                    <Input {...field} placeholder="Ej. Juan" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={profileForm.control}
                                        name="last_name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Apellido</FormLabel>
                                                <FormControl>
                                                    <Input {...field} placeholder="Ej. Pérez" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <FormField
                                    control={profileForm.control}
                                    name="phone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Teléfono</FormLabel>
                                            <FormControl>
                                                <Input {...field} placeholder="Ej. 3001234567" type="tel" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={profileForm.control}
                                    name="document_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Documento de Identidad</FormLabel>
                                            <FormControl>
                                                <Input {...field} placeholder="Ej. 1098765432" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="pt-2 flex justify-end">
                                    <Button
                                        type="submit"
                                        disabled={isProfilePending || !profileForm.formState.isDirty}
                                        className="gap-2"
                                    >
                                        {isProfilePending ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Save className="w-4 h-4" />
                                        )}
                                        Guardar Cambios
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </CardContent>
                </Card>

                {/* Password Security Card */}
                <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Lock className="w-5 h-5 text-brand" />
                            Seguridad
                        </CardTitle>
                        <CardDescription>
                            Cambia tu contraseña de acceso al sistema.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...passwordForm}>
                            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                                <FormField
                                    control={passwordForm.control}
                                    name="current_password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Contraseña actual</FormLabel>
                                            <FormControl>
                                                <Input {...field} type="password" placeholder="••••••••" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={passwordForm.control}
                                    name="new_password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Nueva contraseña</FormLabel>
                                            <FormControl>
                                                <Input {...field} type="password" placeholder="Mínimo 8 caracteres" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={passwordForm.control}
                                    name="confirm_password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Confirmar nueva contraseña</FormLabel>
                                            <FormControl>
                                                <Input {...field} type="password" placeholder="••••••••" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="pt-2 flex justify-end">
                                    <Button
                                        type="submit"
                                        variant="outline"
                                        className="border-brand/30 hover:bg-brand/10 text-brand gap-2"
                                        disabled={isPasswordPending}
                                    >
                                        {isPasswordPending ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Lock className="w-4 h-4" />
                                        )}
                                        Actualizar Contraseña
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </CardContent>
                </Card>

                {/* Appearance Card */}
                <Card className="border-border/50 bg-card/80 backdrop-blur-sm md:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Monitor className="w-5 h-5 text-brand" />
                            Apariencia
                        </CardTitle>
                        <CardDescription>
                            Personaliza el tema visual de la aplicación.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {!mounted ? (
                            <div className="h-11 w-full bg-muted/50 rounded-lg animate-pulse" />
                        ) : (
                            <div className="flex items-center gap-4">
                                <Button
                                    variant={theme === 'light' ? 'default' : 'outline'}
                                    onClick={() => setTheme('light')}
                                    className="w-full gap-2"
                                >
                                    <Sun className="w-4 h-4" />
                                    Claro
                                </Button>
                                <Button
                                    variant={theme === 'dark' ? 'default' : 'outline'}
                                    onClick={() => setTheme('dark')}
                                    className="w-full gap-2"
                                >
                                    <Moon className="w-4 h-4" />
                                    Oscuro
                                </Button>
                                <Button
                                    variant={theme === 'system' ? 'default' : 'outline'}
                                    onClick={() => setTheme('system')}
                                    className="w-full gap-2"
                                >
                                    <Monitor className="w-4 h-4" />
                                    Sistema
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
