'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarDays, Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores'
import { formatCOP } from '@/lib/utils/currency'

interface AppointmentRow {
    id: string
    status: string
    starts_at: string
    ends_at: string
    total_price: number
    is_walk_in: boolean
    walk_in_name: string | null
    notes: string | null
    professional: { first_name: string; last_name: string } | null
    client: { first_name: string; last_name: string } | null
    services: { service: { name: string } | null }[]
}

export default function AppointmentsPage() {
    const { user } = useAuthStore()
    const [appointments, setAppointments] = useState<AppointmentRow[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchAppointments = async () => {
            if (!user) return
            const supabase = createClient()
            const isSuperAdmin = user.role === 'super_admin'

            let query = supabase
                .from('appointments')
                .select(`
                    id, status, starts_at, ends_at, total_price, is_walk_in, walk_in_name, notes,
                    professional:profiles!appointments_professional_id_fkey(first_name, last_name),
                    client:profiles!appointments_client_id_fkey(first_name, last_name),
                    services:appointment_services(service:services(name))
                `)
                .order('starts_at', { ascending: false })
                .limit(20)

            if (!isSuperAdmin && user.business_id) {
                query = query.eq('business_id', user.business_id)
            }

            const { data } = await query
            setAppointments((data as unknown as AppointmentRow[]) ?? [])
            setLoading(false)
        }
        fetchAppointments()
    }, [user])

    const statusLabel: Record<string, string> = {
        scheduled: 'Agendada',
        in_progress: 'En Progreso',
        completed: 'Completada',
        approved: 'Aprobada',
        cancelled: 'Cancelada',
        no_show: 'No Asistió',
    }

    const statusColor: Record<string, string> = {
        scheduled: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
        in_progress: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
        completed: 'bg-green-500/10 text-green-500 border-green-500/20',
        approved: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
        cancelled: 'bg-red-500/10 text-red-500 border-red-500/20',
        no_show: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Citas</h1>
                    <p className="text-muted-foreground">Agenda, citas express y aprobaciones</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline">
                        <Plus className="w-4 h-4 mr-2" />
                        Cita Express
                    </Button>
                    <Button className="gradient-brand text-white">
                        <Plus className="w-4 h-4 mr-2" />
                        Nueva Cita
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
            ) : appointments.length === 0 ? (
                <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                    <CardContent className="py-12 text-center">
                        <CalendarDays className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                        <p className="text-muted-foreground">No hay citas registradas aún.</p>
                    </CardContent>
                </Card>
            ) : (
                <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CalendarDays className="w-5 h-5" />
                            Listado de Citas ({appointments.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border/50">
                                        <th className="text-left py-3 px-2 text-muted-foreground font-medium">Fecha / Hora</th>
                                        <th className="text-left py-3 px-2 text-muted-foreground font-medium">Profesional</th>
                                        <th className="text-left py-3 px-2 text-muted-foreground font-medium">Cliente</th>
                                        <th className="text-left py-3 px-2 text-muted-foreground font-medium">Servicios</th>
                                        <th className="text-right py-3 px-2 text-muted-foreground font-medium">Total</th>
                                        <th className="text-center py-3 px-2 text-muted-foreground font-medium">Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {appointments.map((appt) => (
                                        <tr key={appt.id} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                                            <td className="py-3 px-2">
                                                <div className="font-medium">
                                                    {new Date(appt.starts_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {new Date(appt.starts_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                                    {' - '}
                                                    {new Date(appt.ends_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </td>
                                            <td className="py-3 px-2">
                                                {appt.professional?.first_name} {appt.professional?.last_name}
                                            </td>
                                            <td className="py-3 px-2">
                                                {appt.is_walk_in ? (
                                                    <span className="text-muted-foreground italic">{appt.walk_in_name || 'Sin cita'}</span>
                                                ) : (
                                                    appt.client ? `${appt.client.first_name} ${appt.client.last_name}` : '—'
                                                )}
                                            </td>
                                            <td className="py-3 px-2">
                                                <div className="flex flex-wrap gap-1">
                                                    {appt.services?.map((s, i) => (
                                                        <Badge key={i} variant="secondary" className="text-xs">
                                                            {s.service?.name || '—'}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="py-3 px-2 text-right font-semibold">
                                                {formatCOP(appt.total_price)}
                                            </td>
                                            <td className="py-3 px-2 text-center">
                                                <Badge className={`text-xs ${statusColor[appt.status] || ''}`}>
                                                    {statusLabel[appt.status] || appt.status}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
