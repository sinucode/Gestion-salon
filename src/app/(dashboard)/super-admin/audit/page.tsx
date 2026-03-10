'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'

interface AuditRow { id: string; user_id: string; business_id: string | null; table_name: string; record_id: string; action: string; old_values: Record<string, unknown> | null; new_values: Record<string, unknown> | null; created_at: string; user?: { first_name: string; last_name: string } }

const ACTION_COLORS: Record<string, string> = { INSERT: 'bg-green-500/10 text-green-500', UPDATE: 'bg-blue-500/10 text-blue-500', DELETE: 'bg-red-500/10 text-red-500' }

export default function AuditPage() {
    const [logs, setLogs] = useState<AuditRow[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchLogs = async () => {
            const supabase = createClient()
            const { data } = await supabase.from('audit_log').select('*, user:profiles!audit_log_user_id_fkey(first_name, last_name)').order('created_at', { ascending: false }).limit(50)
            if (data) setLogs(data as unknown as AuditRow[])
            setLoading(false)
        }
        fetchLogs()
    }, [])

    if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>

    return (
        <div className="space-y-6">
            <div><h1 className="text-2xl font-bold tracking-tight">Auditoría</h1><p className="text-muted-foreground">Registro inmutable de acciones en el sistema</p></div>

            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><FileText className="w-5 h-5" />Últimas 50 acciones</CardTitle></CardHeader>
                <CardContent className="p-0">
                    {logs.length === 0 ? (
                        <p className="text-center text-muted-foreground py-12">No hay registros de auditoría.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead><tr className="border-b border-border/50">
                                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Fecha</th>
                                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Usuario</th>
                                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Tabla</th>
                                    <th className="text-center py-3 px-4 font-medium text-muted-foreground">Acción</th>
                                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Detalles</th>
                                </tr></thead>
                                <tbody>{logs.map(l => (
                                    <tr key={l.id} className="border-b border-border/20 hover:bg-muted/30">
                                        <td className="py-3 px-4 text-xs whitespace-nowrap">{new Date(l.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                                        <td className="py-3 px-4">{l.user?.first_name} {l.user?.last_name}</td>
                                        <td className="py-3 px-4 font-mono text-xs">{l.table_name}</td>
                                        <td className="py-3 px-4 text-center"><Badge className={`text-xs ${ACTION_COLORS[l.action] || ''}`}>{l.action}</Badge></td>
                                        <td className="py-3 px-4 text-xs text-muted-foreground max-w-[300px] truncate">{l.new_values ? JSON.stringify(l.new_values).substring(0, 80) + '...' : '—'}</td>
                                    </tr>
                                ))}</tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
