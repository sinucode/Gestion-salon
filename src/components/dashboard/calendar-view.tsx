'use client'

import { useState, useMemo, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, startOfDay, endOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, User, Clock, Info } from 'lucide-react'
import { getColombianHolidays, isHoliday, Holiday } from '@/lib/utils/holidays'
import { createClient } from '@/lib/supabase/client'
import { formatCOP } from '@/lib/utils/currency'

interface CalendarViewProps {
    businessId: string | null
}

interface Professional {
    id: string
    first_name: string
    last_name: string
}

interface Appointment {
    id: string
    status: string
    total_price: number
    starts_at: string
    ends_at: string
    professional_id: string
    client: { first_name: string; last_name: string } | null
}

export function CalendarView({ businessId }: CalendarViewProps) {
    const [date, setDate] = useState<Date | undefined>(new Date())
    const [holidays, setHolidays] = useState<Holiday[]>([])
    const [professionals, setProfessionals] = useState<Professional[]>([])
    const [appointments, setAppointments] = useState<Appointment[]>([])
    const [loading, setLoading] = useState(false)

    // Load holidays for the current year
    useEffect(() => {
        const year = date?.getFullYear() || new Date().getFullYear()
        setHolidays(getColombianHolidays(year))
    }, [date])

    // Load professionals for the business
    useEffect(() => {
        const fetchProfessionals = async () => {
            const supabase = createClient()
            let query = supabase.from('profiles').select('id, first_name, last_name').eq('role', 'professional').eq('is_active', true)
            if (businessId) query = query.eq('business_id', businessId)
            const { data } = await query
            if (data) setProfessionals(data)
        }
        fetchProfessionals()
    }, [businessId])

    // Load appointments for the selected day
    useEffect(() => {
        const fetchAppointments = async () => {
            if (!date) return
            setLoading(true)
            const supabase = createClient()
            const start = startOfDay(date).toISOString()
            const end = endOfDay(date).toISOString()

            let query = supabase.from('appointments')
                .select('id, status, total_price, starts_at, ends_at, professional_id, client:profiles!appointments_client_id_fkey(first_name, last_name)')
                .gte('starts_at', start)
                .lte('starts_at', end)
            
            if (businessId) query = query.eq('business_id', businessId)
            
            const { data } = await query
            if (data) setAppointments(data as unknown as Appointment[])
            setLoading(false)
        }
        fetchAppointments()
    }, [date, businessId])

    const selectedHoliday = useMemo(() => {
        return date ? isHoliday(date, holidays) : undefined
    }, [date, holidays])

    const statusColor: Record<string, string> = { 
        scheduled: 'bg-blue-500/10 border-blue-500/50 text-blue-700', 
        in_progress: 'bg-yellow-500/10 border-yellow-500/50 text-yellow-700', 
        completed: 'bg-green-500/10 border-green-500/50 text-green-700', 
        approved: 'bg-emerald-500/10 border-emerald-500/50 text-emerald-700', 
        cancelled: 'bg-red-500/10 border-red-500/50 text-red-700', 
        no_show: 'bg-gray-500/10 border-gray-500/50 text-gray-700' 
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Monthly Calendar */}
            <Card className="lg:col-span-4 border-border/50 bg-card/80 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Clock className="w-5 h-5 text-primary" />
                        Calendario
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        locale={es}
                        className="rounded-md border border-border/50"
                        modifiers={{
                            holiday: (day) => !!isHoliday(day, holidays)
                        }}
                        modifiersStyles={{
                            holiday: { color: 'white', backgroundColor: '#ef4444' }
                        }}
                    />
                    {selectedHoliday && (
                        <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-3">
                            <Info className="w-4 h-4 text-red-500" />
                            <p className="text-xs font-semibold text-red-600">Festivo: {selectedHoliday.name}</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Daily Agenda */}
            <Card className="lg:col-span-8 border-border/50 bg-card/80 backdrop-blur-sm">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">Agenda: {date ? format(date, "EEEE, d 'de' MMMM", { locale: es }) : ''}</CardTitle>
                        <Badge variant="outline" className="capitalize">{date ? format(date, 'yyyy') : ''}</Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-24">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : professionals.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            No hay profesionales registrados para este negocio.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <div className="flex gap-4 min-w-[600px]">
                                {professionals.map((prof) => {
                                    const profAppts = appointments.filter(a => a.professional_id === prof.id)
                                    return (
                                        <div key={prof.id} className="flex-1 min-w-[200px] space-y-3">
                                            <div className="p-3 rounded-lg bg-muted/50 border border-border/50 text-center">
                                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2 text-primary">
                                                    <User className="w-5 h-5" />
                                                </div>
                                                <p className="text-sm font-bold">{prof.first_name} {prof.last_name}</p>
                                                <Badge variant="secondary" className="text-[10px] mt-1">{profAppts.length} citas</Badge>
                                            </div>

                                            <div className="space-y-2">
                                                {profAppts.length === 0 ? (
                                                    <p className="text-[10px] text-center text-muted-foreground py-4">Sin citas</p>
                                                ) : (
                                                    profAppts.map((appt) => (
                                                        <div 
                                                            key={appt.id} 
                                                            className={`p-2 rounded border text-xs shadow-sm transition-all hover:scale-[1.02] ${statusColor[appt.status] || 'bg-muted border-border'}`}
                                                        >
                                                            <div className="flex justify-between items-start mb-1">
                                                                <span className="font-bold opacity-80">
                                                                    {format(new Date(appt.starts_at), 'HH:mm')}
                                                                </span>
                                                                <span className="text-[9px] font-medium bg-black/5 px-1 rounded">
                                                                    {formatCOP(appt.total_price)}
                                                                </span>
                                                            </div>
                                                            <p className="font-semibold truncate">
                                                                {appt.client ? `${appt.client.first_name} ${appt.client.last_name}` : 'Cliente Anon.'}
                                                            </p>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
