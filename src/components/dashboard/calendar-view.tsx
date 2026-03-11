'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import {
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isSameDay,
    isSameMonth,
    addMonths,
    subMonths,
    startOfWeek,
    endOfWeek,
    startOfDay,
    endOfDay,
    isToday,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
    Loader2,
    User,
    ChevronLeft,
    ChevronRight,
    Clock,
    MapPin,
    Calendar as CalendarIcon,
    X,
    ExternalLink,
    Sparkles,
    DollarSign,
    Scissors,
    FileText,
} from 'lucide-react'
import { getColombianHolidays, isHoliday, type Holiday } from '@/lib/utils/holidays'
import { createClient } from '@/lib/supabase/client'
import { formatCOP } from '@/lib/utils/currency'
import type { Business } from '@/types'

interface CalendarViewProps {
    businessId: string | null
}

interface Appointment {
    id: string
    status: string
    total_price: number
    starts_at: string
    ends_at: string
    professional_id: string
    location_id: string
    professional: { first_name: string; last_name: string } | null
    client: { first_name: string; last_name: string } | null
    location: { name: string } | null
}

interface DetailAppointment extends Appointment {
    notes: string | null
    services: { name: string; price: number; duration_min: number }[]
}

interface DayAppointmentCount {
    [dateKey: string]: number
}

const STATUS_LABELS: Record<string, string> = {
    scheduled: 'Agendada',
    in_progress: 'En Progreso',
    completed: 'Completada',
    approved: 'Aprobada',
    cancelled: 'Cancelada',
    no_show: 'No Asistió',
}

const STATUS_CONFIG: Record<string, { bg: string; border: string; text: string; dot: string }> = {
    scheduled: { bg: 'bg-blue-500/5', border: 'border-blue-500/30', text: 'text-blue-600', dot: 'bg-blue-500' },
    in_progress: { bg: 'bg-amber-500/5', border: 'border-amber-500/30', text: 'text-amber-600', dot: 'bg-amber-500' },
    completed: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/30', text: 'text-emerald-600', dot: 'bg-emerald-500' },
    approved: { bg: 'bg-green-500/5', border: 'border-green-500/30', text: 'text-green-600', dot: 'bg-green-500' },
    cancelled: { bg: 'bg-red-500/5', border: 'border-red-500/30', text: 'text-red-600', dot: 'bg-red-500' },
    no_show: { bg: 'bg-gray-500/5', border: 'border-gray-500/30', text: 'text-gray-500', dot: 'bg-gray-400' },
}

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export function CalendarView({ businessId }: CalendarViewProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())
    const [holidays, setHolidays] = useState<Holiday[]>([])
    const [dayAppointments, setDayAppointments] = useState<Appointment[]>([])
    const [monthCounts, setMonthCounts] = useState<DayAppointmentCount>({})
    const [businessData, setBusinessData] = useState<Business | null>(null)
    const [loadingDay, setLoadingDay] = useState(false)
    const [loadingMonth, setLoadingMonth] = useState(false)
    const [selectedAppt, setSelectedAppt] = useState<DetailAppointment | null>(null)
    const [loadingDetail, setLoadingDetail] = useState(false)

    // Fetch business branding
    useEffect(() => {
        if (!businessId) { setBusinessData(null); return }
        const supabase = createClient()
        supabase.from('businesses').select('*').eq('id', businessId).single()
            .then(({ data }) => { if (data) setBusinessData(data as Business) })
    }, [businessId])

    // Holidays for the year
    useEffect(() => {
        setHolidays(getColombianHolidays(currentMonth.getFullYear()))
    }, [currentMonth])

    // Fetch appointment counts for entire month (for dot indicators)
    const fetchMonthCounts = useCallback(async () => {
        setLoadingMonth(true)
        const supabase = createClient()
        const start = startOfMonth(currentMonth).toISOString()
        const end = endOfMonth(currentMonth).toISOString()

        let query = supabase.from('appointments')
            .select('starts_at')
            .gte('starts_at', start)
            .lte('starts_at', end)
        if (businessId) query = query.eq('business_id', businessId)

        const { data } = await query
        const counts: DayAppointmentCount = {}
        data?.forEach((a: any) => {
            const key = format(new Date(a.starts_at), 'yyyy-MM-dd')
            counts[key] = (counts[key] || 0) + 1
        })
        setMonthCounts(counts)
        setLoadingMonth(false)
    }, [currentMonth, businessId])

    useEffect(() => { fetchMonthCounts() }, [fetchMonthCounts])

    // Fetch appointments for the selected day
    const fetchDayAppointments = useCallback(async () => {
        if (!selectedDate) { setDayAppointments([]); return }
        setLoadingDay(true)
        const supabase = createClient()
        const start = startOfDay(selectedDate).toISOString()
        const end = endOfDay(selectedDate).toISOString()

        let query = supabase.from('appointments')
            .select(`
                id, status, total_price, starts_at, ends_at, professional_id, location_id,
                professional:profiles!appointments_professional_id_fkey(first_name, last_name),
                client:profiles!appointments_client_id_fkey(first_name, last_name),
                location:locations!appointments_location_id_fkey(name)
            `)
            .gte('starts_at', start)
            .lte('starts_at', end)
            .order('starts_at', { ascending: true })

        if (businessId) query = query.eq('business_id', businessId)

        const { data } = await query
        setDayAppointments((data as unknown as Appointment[]) ?? [])
        setLoadingDay(false)
    }, [selectedDate, businessId])

    useEffect(() => { fetchDayAppointments() }, [fetchDayAppointments])

    // Calendar grid days
    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(currentMonth)
        const monthEnd = endOfMonth(currentMonth)
        const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
        const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
        return eachDayOfInterval({ start: calStart, end: calEnd })
    }, [currentMonth])

    const primaryColor = businessData?.primary_color || '#7c3aed'
    const secondaryColor = businessData?.secondary_color || '#4f46e5'

    const selectedHoliday = selectedDate ? isHoliday(selectedDate, holidays) : undefined

    return (
        <div className="space-y-6">
            {/* Full-width Calendar */}
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden shadow-lg">
                {/* Calendar Header */}
                <div
                    className="px-6 py-4 flex items-center justify-between"
                    style={{ background: `linear-gradient(135deg, ${primaryColor}18, ${secondaryColor}10)` }}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm" style={{ background: primaryColor }}>
                            <CalendarIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold capitalize">
                                {format(currentMonth, 'MMMM yyyy', { locale: es })}
                            </h2>
                            {businessData && (
                                <p className="text-xs text-muted-foreground">{businessData.name}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                            className="hover:bg-white/50"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setCurrentMonth(new Date()); setSelectedDate(new Date()) }}
                            className="text-xs font-medium px-3"
                        >
                            Hoy
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                            className="hover:bg-white/50"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                <CardContent className="p-0">
                    {/* Weekday headers */}
                    <div className="grid grid-cols-7 border-b border-border/30">
                        {WEEKDAY_LABELS.map((day, i) => (
                            <div
                                key={day}
                                className={`py-3 text-center text-xs font-semibold uppercase tracking-wider ${i >= 5 ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}
                            >
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7">
                        {calendarDays.map((day, idx) => {
                            const dateKey = format(day, 'yyyy-MM-dd')
                            const inMonth = isSameMonth(day, currentMonth)
                            const today = isToday(day)
                            const selected = selectedDate ? isSameDay(day, selectedDate) : false
                            const holiday = isHoliday(day, holidays)
                            const count = monthCounts[dateKey] || 0
                            const isWeekend = day.getDay() === 0 || day.getDay() === 6

                            return (
                                <button
                                    key={idx}
                                    onClick={() => setSelectedDate(day)}
                                    className={`
                                        relative min-h-[80px] p-2 border-b border-r border-border/10 text-left transition-all duration-150
                                        hover:bg-muted/40 group
                                        ${!inMonth ? 'opacity-30' : ''}
                                        ${selected ? 'z-10' : ''}
                                        ${isWeekend && inMonth ? 'bg-muted/15' : ''}
                                    `}
                                    style={selected ? { outlineColor: primaryColor, outline: `2px solid ${primaryColor}`, outlineOffset: '-2px', backgroundColor: `${primaryColor}08` } : undefined}
                                >
                                    <div className="flex items-start justify-between">
                                        <span
                                            className={`
                                                inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium transition-colors
                                                ${today && !selected ? 'text-white font-bold' : ''}
                                                ${selected ? 'text-white font-bold' : ''}
                                                ${holiday && !today && !selected ? 'text-red-500 font-bold' : ''}
                                                ${!today && !selected && !holiday ? 'text-foreground' : ''}
                                            `}
                                            style={
                                                today && !selected
                                                    ? { backgroundColor: primaryColor }
                                                    : selected
                                                        ? { backgroundColor: primaryColor }
                                                        : undefined
                                            }
                                        >
                                            {format(day, 'd')}
                                        </span>
                                        {holiday && (
                                            <Sparkles className="w-3 h-3 text-red-400 mt-1" />
                                        )}
                                    </div>

                                    {/* Appointment count indicator */}
                                    {count > 0 && inMonth && (
                                        <div className="mt-1 flex items-center gap-1">
                                            <div
                                                className="h-1.5 rounded-full transition-all"
                                                style={{
                                                    width: `${Math.min(count * 15, 100)}%`,
                                                    backgroundColor: `${primaryColor}60`,
                                                }}
                                            />
                                            <span className="text-[9px] text-muted-foreground font-medium">{count}</span>
                                        </div>
                                    )}

                                    {/* Holiday name tooltip on hover */}
                                    {holiday && inMonth && (
                                        <p className="text-[8px] leading-tight text-red-400 mt-0.5 truncate font-medium">
                                            {holiday.name}
                                        </p>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Day Detail Panel */}
            {selectedDate && (
                <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-lg overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
                    {/* Panel Header */}
                    <div
                        className="px-6 py-4 flex items-center justify-between"
                        style={{ background: `linear-gradient(135deg, ${primaryColor}12, transparent)` }}
                    >
                        <div>
                            <h3 className="text-lg font-bold capitalize">
                                {format(selectedDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
                            </h3>
                            <div className="flex items-center gap-3 mt-1">
                                {selectedHoliday && (
                                    <Badge variant="destructive" className="text-[10px] gap-1">
                                        <Sparkles className="w-3 h-3" />
                                        {selectedHoliday.name}
                                    </Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                    {dayAppointments.length} {dayAppointments.length === 1 ? 'cita' : 'citas'}
                                </span>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setSelectedDate(null)}>
                            <X className="w-4 h-4" />
                        </Button>
                    </div>

                    <CardContent className="p-6">
                        {loadingDay ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="w-6 h-6 animate-spin" style={{ color: primaryColor }} />
                            </div>
                        ) : dayAppointments.length === 0 ? (
                            <div className="text-center py-16 space-y-3">
                                <CalendarIcon className="w-16 h-16 mx-auto opacity-10" />
                                <p className="text-muted-foreground text-sm">No hay citas programadas para este día</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {dayAppointments.map((appt) => {
                                    const cfg = STATUS_CONFIG[appt.status] || STATUS_CONFIG.scheduled
                                    return (
                                        <div
                                            key={appt.id}
                                            onClick={async () => {
                                                setLoadingDetail(true)
                                                const supabase = createClient()
                                                const { data } = await supabase.from('appointments')
                                                    .select(`
                                                        id, status, total_price, starts_at, ends_at, professional_id, location_id, notes,
                                                        professional:profiles!appointments_professional_id_fkey(first_name, last_name),
                                                        client:profiles!appointments_client_id_fkey(first_name, last_name),
                                                        location:locations!appointments_location_id_fkey(name),
                                                        services:appointment_services(name:services(name), price:services(price), duration_min:services(duration_min))
                                                    `)
                                                    .eq('id', appt.id)
                                                    .single()
                                                setSelectedAppt(data as unknown as DetailAppointment)
                                                setLoadingDetail(false)
                                            }}
                                            className={`
                                                group flex items-stretch gap-0 rounded-xl border overflow-hidden
                                                cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-[1.005]
                                                ${cfg.bg} ${cfg.border}
                                            `}
                                        >
                                            {/* Left time bar */}
                                            <div
                                                className="w-1.5 shrink-0"
                                                style={{ backgroundColor: primaryColor }}
                                            />

                                            {/* Time block */}
                                            <div className="px-4 py-3 flex items-center border-r border-border/20 min-w-[100px]">
                                                <div className="text-center">
                                                    <p className="text-lg font-bold leading-none" style={{ color: primaryColor }}>
                                                        {format(new Date(appt.starts_at), 'HH:mm')}
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                                        {format(new Date(appt.ends_at), 'HH:mm')}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Main content */}
                                            <div className="flex-1 px-4 py-3 flex items-center justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <p className="font-bold text-sm truncate">
                                                            {appt.client
                                                                ? `${appt.client.first_name} ${appt.client.last_name}`
                                                                : 'Cliente sin registrar'}
                                                        </p>
                                                        <div className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                                                        <span className={`text-[10px] font-semibold ${cfg.text}`}>
                                                            {STATUS_LABELS[appt.status]}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                        {appt.professional && (
                                                            <span className="flex items-center gap-1">
                                                                <User className="w-3 h-3" />
                                                                {appt.professional.first_name} {appt.professional.last_name}
                                                            </span>
                                                        )}
                                                        {appt.location && (
                                                            <span className="flex items-center gap-1">
                                                                <MapPin className="w-3 h-3" />
                                                                {appt.location.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Price + action */}
                                                <div className="flex items-center gap-3 shrink-0">
                                                    <p className="text-sm font-bold" style={{ color: primaryColor }}>
                                                        {formatCOP(appt.total_price)}
                                                    </p>
                                                    <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-40 transition-opacity" />
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Appointment Detail Dialog */}
            <Dialog open={!!selectedAppt} onOpenChange={(open) => { if (!open) setSelectedAppt(null) }}>
                <DialogContent className="sm:max-w-lg">
                    {selectedAppt && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${primaryColor}15` }}>
                                        <CalendarIcon className="w-4 h-4" style={{ color: primaryColor }} />
                                    </div>
                                    Detalle de Cita
                                </DialogTitle>
                            </DialogHeader>

                            <div className="space-y-5 py-2">
                                {/* Date & Time */}
                                <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border/30">
                                    <div className="text-center">
                                        <p className="text-2xl font-black leading-none" style={{ color: primaryColor }}>
                                            {format(new Date(selectedAppt.starts_at), 'HH:mm')}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            a {format(new Date(selectedAppt.ends_at), 'HH:mm')}
                                        </p>
                                    </div>
                                    <div className="h-10 w-px bg-border/50" />
                                    <div>
                                        <p className="text-sm font-semibold capitalize">
                                            {format(new Date(selectedAppt.starts_at), "EEEE, d 'de' MMMM", { locale: es })}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className={`w-2 h-2 rounded-full ${(STATUS_CONFIG[selectedAppt.status] || STATUS_CONFIG.scheduled).dot}`} />
                                            <span className={`text-xs font-semibold ${(STATUS_CONFIG[selectedAppt.status] || STATUS_CONFIG.scheduled).text}`}>
                                                {STATUS_LABELS[selectedAppt.status]}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Client & Professional */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 rounded-xl bg-muted/20 border border-border/20 space-y-1">
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Cliente</p>
                                        <p className="text-sm font-bold">
                                            {selectedAppt.client ? `${selectedAppt.client.first_name} ${selectedAppt.client.last_name}` : 'Sin registrar'}
                                        </p>
                                    </div>
                                    <div className="p-3 rounded-xl bg-muted/20 border border-border/20 space-y-1">
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Profesional</p>
                                        <p className="text-sm font-bold flex items-center gap-1">
                                            <User className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                                            {selectedAppt.professional ? `${selectedAppt.professional.first_name} ${selectedAppt.professional.last_name}` : '—'}
                                        </p>
                                    </div>
                                </div>

                                {/* Location */}
                                {selectedAppt.location && (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <MapPin className="w-4 h-4" style={{ color: primaryColor }} />
                                        <span className="font-medium">{selectedAppt.location.name}</span>
                                    </div>
                                )}

                                {/* Services */}
                                {selectedAppt.services && selectedAppt.services.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1">
                                            <Scissors className="w-3 h-3" /> Servicios
                                        </p>
                                        <div className="space-y-1.5">
                                            {selectedAppt.services.map((s: any, i: number) => (
                                                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/20 border border-border/10 text-sm">
                                                    <span className="font-medium">{s.name?.name || s.name}</span>
                                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                        <span>{s.duration_min?.duration_min || s.duration_min} min</span>
                                                        <span className="font-semibold" style={{ color: primaryColor }}>{formatCOP(s.price?.price || s.price)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Notes */}
                                {selectedAppt.notes && (
                                    <div className="space-y-1">
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1">
                                            <FileText className="w-3 h-3" /> Notas
                                        </p>
                                        <p className="text-sm text-muted-foreground bg-muted/20 rounded-lg p-3 border border-border/10">{selectedAppt.notes}</p>
                                    </div>
                                )}

                                {/* Total */}
                                <div className="flex items-center justify-between p-4 rounded-xl border border-border/30" style={{ background: `${primaryColor}08` }}>
                                    <span className="text-sm font-semibold flex items-center gap-2">
                                        <DollarSign className="w-4 h-4" style={{ color: primaryColor }} />
                                        Total
                                    </span>
                                    <span className="text-xl font-black" style={{ color: primaryColor }}>
                                        {formatCOP(selectedAppt.total_price)}
                                    </span>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
