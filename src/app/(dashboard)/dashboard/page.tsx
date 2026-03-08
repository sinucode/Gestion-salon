'use client'

import { useAuthStore, useFeatureFlagsStore } from '@/stores'
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
} from 'lucide-react'
import { formatCOP } from '@/lib/utils/currency'

export default function DashboardPage() {
    const { user, business, location } = useAuthStore()
    const { isEnabled } = useFeatureFlagsStore()

    // Placeholder KPIs — will be populated with real data from Supabase
    const kpis = {
        appointmentsToday: 0,
        pendingApproval: 0,
        grossIncomeToday: 0,
        activeClients: 0,
        lowStockItems: 0,
        pendingDamages: 0,
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">
                    Bienvenido{user ? `, ${user.first_name}` : ''}
                </h1>
                <p className="text-muted-foreground mt-1">
                    {business?.name && (
                        <span>
                            {business.name}
                            {location?.name && <span className="text-muted-foreground/60"> · {location.name}</span>}
                        </span>
                    )}
                    {!business?.name && 'Panel de gestión integral'}
                </p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 bg-card/80 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Citas Hoy
                        </CardTitle>
                        <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                            <CalendarDays className="h-4 w-4 text-primary" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{kpis.appointmentsToday}</div>
                        <div className="flex items-center gap-1 mt-1">
                            <Badge variant="secondary" className="text-xs font-normal">
                                <Clock className="w-3 h-3 mr-1" />
                                {kpis.pendingApproval} por aprobar
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 bg-card/80 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Ingresos Hoy
                        </CardTitle>
                        <div className="p-2 rounded-lg bg-success/10 group-hover:bg-success/20 transition-colors">
                            <DollarSign className="h-4 w-4 text-success" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{formatCOP(kpis.grossIncomeToday)}</div>
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <TrendingUp className="w-3 h-3 text-success" />
                            Ingresos brutos del día
                        </div>
                    </CardContent>
                </Card>

                <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 bg-card/80 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Clientes Activos
                        </CardTitle>
                        <div className="p-2 rounded-lg bg-chart-2/10 group-hover:bg-chart-2/20 transition-colors">
                            <Users className="h-4 w-4 text-chart-2" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{kpis.activeClients}</div>
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <CheckCircle2 className="w-3 h-3 text-success" />
                            Clientes registrados
                        </div>
                    </CardContent>
                </Card>

                <Card className="group hover:shadow-lg transition-all duration-300 border-border/50 bg-card/80 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Inventario
                        </CardTitle>
                        <div className="p-2 rounded-lg bg-warning/10 group-hover:bg-warning/20 transition-colors">
                            <Package className="h-4 w-4 text-warning" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{kpis.lowStockItems}</div>
                        <div className="flex items-center gap-1 mt-1">
                            {kpis.lowStockItems > 0 ? (
                                <Badge variant="destructive" className="text-xs font-normal">
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    Stock bajo
                                </Badge>
                            ) : (
                                <span className="text-xs text-muted-foreground">
                                    <CheckCircle2 className="w-3 h-3 inline mr-1 text-success" />
                                    Stock saludable
                                </span>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Actions / Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="text-lg">Actividad Reciente</CardTitle>
                        <CardDescription>Últimas acciones en el sistema</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground text-center py-8">
                                Conecta tu base de datos de Supabase para ver la actividad.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="text-lg">Citas Pendientes</CardTitle>
                        <CardDescription>Citas que requieren aprobación</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground text-center py-8">
                                Conecta tu base de datos de Supabase para ver las citas.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
