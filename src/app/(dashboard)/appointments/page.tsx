'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarDays, Loader2, CheckCircle2, Play, X, UserX } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores'
import { toast } from 'sonner'
import { format_currency } from '@/lib/utils/currency'

interface Appointment {
    id: string; status: string; total_price: number; starts_at: string; ends_at: string; notes: string | null
    professional: { first_name: string; last_name: string } | null
    client: { first_name: string; last_name: string } | null
    services: { name: string; price: number }[]
}

const STATUS_LABELS: Record<string, string> = { scheduled: 'Agendada', in_progress: 'En Progreso', completed: 'Completada', approved: 'Aprobada', cancelled: 'Cancelada', no_show: 'No Asistió' }
const STATUS_COLORS: Record<string, string> = { scheduled: 'bg-blue-500/10 text-blue-500', in_progress: 'bg-yellow-500/10 text-yellow-500', completed: 'bg-green-500/10 text-green-500', approved: 'bg-emerald-500/10 text-emerald-500', cancelled: 'bg-red-500/10 text-red-500', no_show: 'bg-gray-500/10 text-gray-500' }

export default function AppointmentsPage() {
    const { user, selectedBusinessId } = useAuthStore()
    const isSuperAdmin = user?.role === 'super_admin'
    const filterBusinessId = isSuperAdmin ? selectedBusinessId : user?.business_id

    const [appointments, setAppointments] = useState<Appointment[]>([])
    const [loading, setLoading] = useState(true)

    const fetchAppointments = async () => {
        if (!filterBusinessId && !isSuperAdmin) { setLoading(false); return }
        const supabase = createClient()
        let query = supabase.from('appointments')
            .select('id, status, total_price, starts_at, ends_at, notes, professional:profiles!appointments_professional_id_fkey(first_name, last_name), client:profiles!appointments_client_id_fkey(first_name, last_name), services:appointment_services(name:services(name), price:services(price))')
            .order('starts_at', { ascending: false }).limit(30)
        if (filterBusinessId) query = query.eq('business_id', filterBusinessId)
        const { data } = await query
        if (data) setAppointments(data as unknown as Appointment[])
        setLoading(false)
    }

    useEffect(() => { setLoading(true); fetchAppointments() }, [filterBusinessId])

    const updateStatus = async (id: string, status: string) => {
        const supabase = createClient()
        const { error } = await supabase.from('appointments').update({ status }).eq('id', id)
        if (error) { toast.error(error.message); return }
        toast.success(`Cita ${STATUS_LABELS[status] || status}`); fetchAppointments()
    }

    if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>

    if (!filterBusinessId && isSuperAdmin) return (
        <div className="space-y-6"><h1 className="text-2xl font-bold">Citas</h1>
            <Card className="border-yellow-500/30 bg-yellow-500/5"><CardContent className="py-4 text-sm text-yellow-400 text-center">Selecciona un negocio para ver sus citas.</CardContent></Card>
        </div>
    )

    return (
        <div className="space-y-6">
            <div><h1 className="text-2xl font-bold tracking-tight">Citas</h1><p className="text-muted-foreground">Agenda y gestión de citas</p></div>

            {appointments.length === 0 ? (
                <Card className="border-border/50 bg-card/80"><CardContent className="py-12 text-center"><CalendarDays className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" /><p className="text-muted-foreground">No hay citas registradas.</p></CardContent></Card>
            ) : (
                <Card className="border-border/50 bg-card/80 backdrop-blur-sm"><CardContent className="p-0">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-border/50">
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Fecha</th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Profesional</th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Cliente</th>
                            <th className="text-right py-3 px-4 font-medium text-muted-foreground">Total</th>
                            <th className="text-center py-3 px-4 font-medium text-muted-foreground">Estado</th>
                            <th className="text-center py-3 px-4 font-medium text-muted-foreground">Acciones</th>
                        </tr></thead>
                        <tbody>{appointments.map(a => (
                            <tr key={a.id} className="border-b border-border/20 hover:bg-muted/30">
                                <td className="py-3 px-4 text-xs whitespace-nowrap">{new Date(a.starts_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                                <td className="py-3 px-4">{a.professional?.first_name} {a.professional?.last_name}</td>
                                <td className="py-3 px-4 text-muted-foreground">{a.client?.first_name} {a.client?.last_name}</td>
                                <td className="py-3 px-4 text-right font-semibold">{format_currency(a.total_price)}</td>
                                <td className="py-3 px-4 text-center"><Badge className={`text-xs ${STATUS_COLORS[a.status] || ''}`}>{STATUS_LABELS[a.status] || a.status}</Badge></td>
                                <td className="py-3 px-4 text-center">
                                    <div className="flex gap-1 justify-center">
                                        {a.status === 'scheduled' && <><Button variant="ghost" size="sm" className="text-yellow-500" onClick={() => updateStatus(a.id, 'in_progress')} title="Iniciar"><Play className="w-3 h-3" /></Button><Button variant="ghost" size="sm" className="text-red-500" onClick={() => updateStatus(a.id, 'cancelled')} title="Cancelar"><X className="w-3 h-3" /></Button><Button variant="ghost" size="sm" className="text-gray-400" onClick={() => updateStatus(a.id, 'no_show')} title="No asistió"><UserX className="w-3 h-3" /></Button></>}
                                        {a.status === 'in_progress' && <Button variant="ghost" size="sm" className="text-green-500" onClick={() => updateStatus(a.id, 'completed')} title="Completar"><CheckCircle2 className="w-3 h-3" /></Button>}
                                        {a.status === 'completed' && <Button variant="ghost" size="sm" className="text-emerald-500" onClick={() => updateStatus(a.id, 'approved')} title="Aprobar"><CheckCircle2 className="w-3 h-3 mr-1" />Aprobar</Button>}
                                    </div>
                                </td>
                            </tr>
                        ))}</tbody>
                    </table>
                </CardContent></Card>
            )}
        </div>
    )
}
