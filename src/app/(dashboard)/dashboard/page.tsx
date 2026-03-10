'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '@/stores'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    CalendarDays,
    DollarSign,
    Users,
    Package,
    TrendingUp,
    Clock,
    AlertTriangle,
    CheckCircle2,
    Building2,
    Loader2,
} from 'lucide-react'
import { formatCOP } from '@/lib/utils/currency'

interface KPIs {
    appointmentsToday: number
    pendingApproval: number
    grossIncomeToday: number
    activeClients: number
    lowStockItems: number
    totalBusinesses: number
}

interface RecentAppointment {
    id: string
    status: string
    total_price: number
    starts_at: string
    professional: { first_name: string; last_name: string } | null
    client: { first_name: string; last_name: string } | null
}

export default function DashboardPage() {
    const { user, business, selectedBusinessId } = useAuthStore()
    const isSuperAdmin = user?.role === 'super_admin'

    const [kpis, setKpis] = useState<KPIs>({
        appointmentsToday: 0, pendingApproval: 0, grossIncomeToday: 0,
        activeClients: 0, lowStockItems: 0, totalBusinesses: 0,
    })
    const [recentAppointments, setRecentAppointments] = useState<RecentAppointment[]>([])
    const [loading, setLoading] = useState(true)

    const fetchKPIs = useCallback(async () => {
        if (!user) return
        setLoading(true)
        const supabase = createClient()

        const filterBusinessId = isSuperAdmin ? selectedBusinessId : user.business_id

        const today = new Date()
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString()

        try {
            let apptQuery = supabase.from('appointments').select('id, status, total_price', { count: 'exact' }).gte('starts_at', startOfDay).lte('starts_at', endOfDay)
            if (filterBusinessId) apptQuery = apptQuery.eq('business_id', filterBusinessId)
            const { data: todayAppts, count: apptCount } = await apptQuery

            const pendingApproval = todayAppts?.filter(a => a.status === 'scheduled').length ?? 0
            const grossIncome = todayAppts?.filter(a => a.status === 'completed' || a.status === 'approved').reduce((sum, a) => sum + (a.total_price || 0), 0) ?? 0

            let clientQuery = supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'client').eq('is_active', true)
            if (filterBusinessId) clientQuery = clientQuery.eq('business_id', filterBusinessId)
            const { count: clientCount } = await clientQuery

            let stockQueryAll = supabase.from('products').select('id, stock_qty, min_stock').eq('is_active', true)
            if (filterBusinessId) stockQueryAll = stockQueryAll.eq('business_id', filterBusinessId)
            const { data: products } = await stockQueryAll
            const lowStock = products?.filter(p => p.stock_qty <= p.min_stock).length ?? 0

            let totalBusinesses = 0
            if (isSuperAdmin && !filterBusinessId) {
                const { count } = await supabase.from('businesses').select('id', { count: 'exact' })
                totalBusinesses = count ?? 0
            }

            setKpis({ appointmentsToday: apptCount ?? 0, pendingApproval, grossIncomeToday: grossIncome, activeClients: clientCount ?? 0, lowStockItems: lowStock, totalBusinesses })

            let recentQuery = supabase.from('appointments')
                .select('id, status, total_price, starts_at, professional:profiles!appointments_professional_id_fkey(first_name, last_name), client:profiles!appointments_client_id_fkey(first_name, last_name)')
                .order('starts_at', { ascending: false }).limit(5)
            if (filterBusinessId) recentQuery = recentQuery.eq('business_id', filterBusinessId)
            const { data: recent } = await recentQuery
            setRecentAppointments((recent as unknown as RecentAppointment[]) ?? [])
        } catch (error) {
            console.error('Error fetching KPIs:', error)
        } finally {
            setLoading(false)
        }
    }, [user, isSuperAdmin, selectedBusinessId])

    useEffect(() => { fetchKPIs() }, [fetchKPIs])

    const statusLabel: Record<string, string> = { scheduled: 'Agendada', in_progress: 'En Progreso', completed: 'Completada', approved: 'Aprobada', cancelled: 'Cancelada', no_show: 'No Asistió' }
    const statusColor: Record<string, string> = { scheduled: 'bg-blue-500/10 text-blue-500', in_progress: 'bg-yellow-500/10 text-yellow-500', completed: 'bg-green-500/10 text-green-500', approved: 'bg-emerald-500/10 text-emerald-500', cancelled: 'bg-red-500/10 text-red-500', no_show: 'bg-gray-500/10 text-gray-500' }

    if (loading && !recentAppointments.length) {
        return <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Bienvenido{user ? `, ${user.first_name}` : ''}</h1>
                <p className="text-muted-foreground mt-1">
                    {business?.name && !isSuperAdmin && <span>{business.name}</span>}
                    {isSuperAdmin && !selectedBusinessId && '🛡️ Vista global de la plataforma'}
                    {isSuperAdmin && selectedBusinessId && 'Datos del negocio seleccionado'}
                    {!isSuperAdmin && !business?.name && 'Panel de gestión integral'}
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {isSuperAdmin && !selectedBusinessId && (
                    <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 bg-card/80 backdrop-blur-sm">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Negocios Activos</CardTitle>
                            <div className="p-2 rounded-lg bg-violet-500/10 group-hover:bg-violet-500/20 transition-colors"><Building2 className="h-4 w-4 text-violet-500" /></div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{kpis.totalBusinesses}</div>
                            <div className="text-xs text-muted-foreground mt-1">Registrados en la plataforma</div>
                        </CardContent>
                    </Card>
                )}
                <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 bg-card/80 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Citas Hoy</CardTitle>
                        <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors"><CalendarDays className="h-4 w-4 text-primary" /></div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{kpis.appointmentsToday}</div>
                        <Badge variant="secondary" className="text-xs font-normal mt-1"><Clock className="w-3 h-3 mr-1" />{kpis.pendingApproval} por aprobar</Badge>
                    </CardContent>
                </Card>
                <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 bg-card/80 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos Hoy</CardTitle>
                        <div className="p-2 rounded-lg bg-green-500/10 group-hover:bg-green-500/20 transition-colors"><DollarSign className="h-4 w-4 text-green-500" /></div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{formatCOP(kpis.grossIncomeToday)}</div>
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground"><TrendingUp className="w-3 h-3 text-green-500" />Ingresos brutos del día</div>
                    </CardContent>
                </Card>
                <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 bg-card/80 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Clientes Activos</CardTitle>
                        <div className="p-2 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors"><Users className="h-4 w-4 text-blue-500" /></div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{kpis.activeClients}</div>
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground"><CheckCircle2 className="w-3 h-3 text-green-500" />Clientes registrados</div>
                    </CardContent>
                </Card>
                <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 bg-card/80 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Inventario</CardTitle>
                        <div className="p-2 rounded-lg bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors"><Package className="h-4 w-4 text-orange-500" /></div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{kpis.lowStockItems}</div>
                        {kpis.lowStockItems > 0 ? (
                            <Badge variant="destructive" className="text-xs font-normal mt-1"><AlertTriangle className="w-3 h-3 mr-1" />Stock bajo</Badge>
                        ) : (
                            <span className="text-xs text-muted-foreground"><CheckCircle2 className="w-3 h-3 inline mr-1 text-green-500" />Stock saludable</span>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="text-lg">Últimas Citas</CardTitle>
                    <CardDescription>Las 5 citas más recientes en el sistema</CardDescription>
                </CardHeader>
                <CardContent>
                    {recentAppointments.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No hay citas registradas aún.</p>
                    ) : (
                        <div className="space-y-3">
                            {recentAppointments.map((appt) => (
                                <div key={appt.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
                                    <div className="flex items-center gap-3">
                                        <CalendarDays className="w-4 h-4 text-muted-foreground" />
                                        <div>
                                            <p className="text-sm font-medium">
                                                {appt.professional?.first_name} {appt.professional?.last_name}
                                                {appt.client && <span className="text-muted-foreground"> → {appt.client.first_name} {appt.client.last_name}</span>}
                                            </p>
                                            <p className="text-xs text-muted-foreground">{new Date(appt.starts_at).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-semibold">{formatCOP(appt.total_price)}</span>
                                        <Badge className={`text-xs ${statusColor[appt.status] || ''}`}>{statusLabel[appt.status] || appt.status}</Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
