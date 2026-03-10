'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, Loader2, TrendingUp, TrendingDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores'
import { formatCOP } from '@/lib/utils/currency'

interface CashMovement { id: string; type: string; amount: number; description: string | null; created_at: string; created_by_profile?: { first_name: string; last_name: string } }

const TYPE_LABELS: Record<string, string> = { service_income: 'Ingreso Servicio', product_sale: 'Venta Producto', professional_commission: 'Comisión', expense: 'Gasto', adjustment: 'Ajuste', inventory_consumption: 'Consumo Inventario' }
const TYPE_COLORS: Record<string, string> = { service_income: 'text-green-500', product_sale: 'text-green-400', professional_commission: 'text-orange-400', expense: 'text-red-500', adjustment: 'text-blue-400', inventory_consumption: 'text-yellow-500' }

export default function FinancePage() {
    const { user, selectedBusinessId } = useAuthStore()
    const isSuperAdmin = user?.role === 'super_admin'
    const filterBusinessId = isSuperAdmin ? selectedBusinessId : user?.business_id

    const [movements, setMovements] = useState<CashMovement[]>([])
    const [loading, setLoading] = useState(true)
    const [totals, setTotals] = useState({ income: 0, expense: 0 })

    const fetchMovements = async () => {
        if (!filterBusinessId) { setLoading(false); return }
        const supabase = createClient()
        const { data } = await supabase.from('cash_movements').select('*, created_by_profile:profiles!cash_movements_created_by_fkey(first_name, last_name)').eq('business_id', filterBusinessId).order('created_at', { ascending: false }).limit(50)
        if (data) {
            setMovements(data as unknown as CashMovement[])
            const income = data.filter(m => m.amount > 0).reduce((s, m) => s + m.amount, 0)
            const expense = data.filter(m => m.amount < 0).reduce((s, m) => s + Math.abs(m.amount), 0)
            setTotals({ income, expense })
        }
        setLoading(false)
    }

    useEffect(() => { setLoading(true); fetchMovements() }, [filterBusinessId])

    if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>

    if (!filterBusinessId && isSuperAdmin) return (
        <div className="space-y-6"><h1 className="text-2xl font-bold">Finanzas</h1>
            <Card className="border-yellow-500/30 bg-yellow-500/5"><CardContent className="py-4 text-sm text-yellow-400 text-center">Selecciona un negocio para ver las finanzas.</CardContent></Card>
        </div>
    )

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold tracking-tight">Finanzas</h1>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Ingresos</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-green-500 flex items-center gap-2"><TrendingUp className="w-5 h-5" />{formatCOP(totals.income)}</div></CardContent>
                </Card>
                <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Egresos</CardTitle></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-red-500 flex items-center gap-2"><TrendingDown className="w-5 h-5" />{formatCOP(totals.expense)}</div></CardContent>
                </Card>
                <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Balance</CardTitle></CardHeader>
                    <CardContent><div className={`text-2xl font-bold ${totals.income - totals.expense >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCOP(totals.income - totals.expense)}</div></CardContent>
                </Card>
            </div>

            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><DollarSign className="w-5 h-5" />Movimientos de Caja</CardTitle></CardHeader>
                <CardContent className="p-0">
                    {movements.length === 0 ? (
                        <p className="text-center text-muted-foreground py-12">No hay movimientos de caja.</p>
                    ) : (
                        <table className="w-full text-sm">
                            <thead><tr className="border-b border-border/50">
                                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Fecha</th>
                                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Tipo</th>
                                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Descripción</th>
                                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Creado por</th>
                                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Monto</th>
                            </tr></thead>
                            <tbody>{movements.map(m => (
                                <tr key={m.id} className="border-b border-border/20 hover:bg-muted/30">
                                    <td className="py-3 px-4 text-xs">{new Date(m.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                                    <td className="py-3 px-4"><Badge variant="secondary" className="text-xs">{TYPE_LABELS[m.type] || m.type}</Badge></td>
                                    <td className="py-3 px-4 text-muted-foreground max-w-[250px] truncate">{m.description || '—'}</td>
                                    <td className="py-3 px-4 text-muted-foreground">{m.created_by_profile?.first_name} {m.created_by_profile?.last_name}</td>
                                    <td className={`py-3 px-4 text-right font-semibold ${m.amount >= 0 ? 'text-green-500' : 'text-red-500'}`}>{m.amount >= 0 ? '+' : ''}{formatCOP(m.amount)}</td>
                                </tr>
                            ))}</tbody>
                        </table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
