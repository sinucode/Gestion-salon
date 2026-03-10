'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle, Plus, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores'
import { toast } from 'sonner'
import { formatCOP } from '@/lib/utils/currency'

interface DamageRow { id: string; reported_by: string; product_id: string | null; qty: number; estimated_cost: number; description: string; resolution_status: string; resolution_note: string | null; created_at: string; reporter?: { first_name: string; last_name: string }; product?: { name: string } }

const emptyForm = { product_id: '', qty: 1, estimated_cost: 0, description: '' }
const STATUS_LABELS: Record<string, string> = { pending: 'Pendiente', resolved: 'Resuelto', dismissed: 'Descartado' }
const STATUS_COLORS: Record<string, string> = { pending: 'bg-yellow-500/10 text-yellow-500', resolved: 'bg-green-500/10 text-green-500', dismissed: 'bg-gray-500/10 text-gray-500' }

export default function DamagesPage() {
    const { user, selectedBusinessId } = useAuthStore()
    const isSuperAdmin = user?.role === 'super_admin'
    const filterBusinessId = isSuperAdmin ? selectedBusinessId : user?.business_id

    const [damages, setDamages] = useState<DamageRow[]>([])
    const [products, setProducts] = useState<{ id: string; name: string }[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState(emptyForm)

    const fetchData = async () => {
        if (!filterBusinessId) { setLoading(false); return }
        const supabase = createClient()
        const [{ data: dmg }, { data: prods }] = await Promise.all([
            supabase.from('damage_reports').select('*, reporter:profiles!damage_reports_reported_by_fkey(first_name, last_name), product:products(name)').eq('business_id', filterBusinessId).order('created_at', { ascending: false }),
            supabase.from('products').select('id, name').eq('business_id', filterBusinessId).eq('is_active', true),
        ])
        if (dmg) setDamages(dmg as unknown as DamageRow[])
        if (prods) setProducts(prods)
        setLoading(false)
    }

    useEffect(() => { setLoading(true); fetchData() }, [filterBusinessId])

    const openCreate = () => { setForm({ ...emptyForm, product_id: products[0]?.id || '' }); setDialogOpen(true) }
    const handleSave = async () => {
        setSaving(true); const supabase = createClient()
        const { error } = await supabase.from('damage_reports').insert({
            business_id: filterBusinessId!, location_id: user?.location_id, reported_by: user!.id,
            product_id: form.product_id || null, qty: Number(form.qty), estimated_cost: Number(form.estimated_cost), description: form.description,
        })
        if (error) { toast.error(error.message); setSaving(false); return }
        toast.success('Novedad reportada'); setSaving(false); setDialogOpen(false); fetchData()
    }

    const updateStatus = async (id: string, status: string) => {
        const supabase = createClient()
        const { error } = await supabase.from('damage_reports').update({ resolution_status: status, resolved_by: user!.id, resolved_at: new Date().toISOString() }).eq('id', id)
        if (error) { toast.error(error.message); return }
        toast.success(`Estado actualizado a: ${STATUS_LABELS[status]}`); fetchData()
    }

    if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>

    if (!filterBusinessId && isSuperAdmin) return (
        <div className="space-y-6"><h1 className="text-2xl font-bold">Novedades</h1>
            <Card className="border-yellow-500/30 bg-yellow-500/5"><CardContent className="py-4 text-sm text-yellow-400 text-center">Selecciona un negocio para ver las novedades.</CardContent></Card>
        </div>
    )

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div><h1 className="text-2xl font-bold tracking-tight">Novedades</h1><p className="text-muted-foreground">Reportes de daños y resoluciones</p></div>
                <Button onClick={openCreate} className="gradient-brand text-white"><Plus className="w-4 h-4 mr-2" />Reportar Novedad</Button>
            </div>

            {damages.length === 0 ? (
                <Card className="border-border/50 bg-card/80"><CardContent className="py-12 text-center"><AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" /><p className="text-muted-foreground">No hay novedades registradas.</p></CardContent></Card>
            ) : (
                <Card className="border-border/50 bg-card/80 backdrop-blur-sm"><CardContent className="p-0">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-border/50">
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Fecha</th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Reportado por</th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Producto</th>
                            <th className="text-center py-3 px-4 font-medium text-muted-foreground">Cant.</th>
                            <th className="text-right py-3 px-4 font-medium text-muted-foreground">Costo Est.</th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Descripción</th>
                            <th className="text-center py-3 px-4 font-medium text-muted-foreground">Estado</th>
                            <th className="text-center py-3 px-4 font-medium text-muted-foreground">Acciones</th>
                        </tr></thead>
                        <tbody>{damages.map(d => (
                            <tr key={d.id} className="border-b border-border/20 hover:bg-muted/30">
                                <td className="py-3 px-4 text-xs">{new Date(d.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</td>
                                <td className="py-3 px-4">{d.reporter?.first_name} {d.reporter?.last_name}</td>
                                <td className="py-3 px-4 text-muted-foreground">{d.product?.name || '—'}</td>
                                <td className="py-3 px-4 text-center">{d.qty}</td>
                                <td className="py-3 px-4 text-right">{formatCOP(d.estimated_cost)}</td>
                                <td className="py-3 px-4 text-muted-foreground max-w-[200px] truncate">{d.description}</td>
                                <td className="py-3 px-4 text-center"><Badge className={`text-xs ${STATUS_COLORS[d.resolution_status] || ''}`}>{STATUS_LABELS[d.resolution_status] || d.resolution_status}</Badge></td>
                                <td className="py-3 px-4 text-center">
                                    {d.resolution_status === 'pending' && (
                                        <div className="flex gap-1 justify-center">
                                            <Button variant="ghost" size="sm" className="text-green-500" onClick={() => updateStatus(d.id, 'resolved')}><CheckCircle2 className="w-3 h-3" /></Button>
                                            <Button variant="ghost" size="sm" className="text-gray-400" onClick={() => updateStatus(d.id, 'dismissed')}>✕</Button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}</tbody>
                    </table>
                </CardContent></Card>
            )}

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Reportar Novedad</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        {products.length > 0 && (
                            <div><Label>Producto</Label>
                                <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}>
                                    <option value="">Sin producto</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>Cantidad</Label><Input type="number" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: Number(e.target.value) }))} /></div>
                            <div><Label>Costo Estimado</Label><Input type="number" value={form.estimated_cost} onChange={e => setForm(f => ({ ...f, estimated_cost: Number(e.target.value) }))} /></div>
                        </div>
                        <div><Label>Descripción *</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describa la novedad..." /></div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button onClick={handleSave} disabled={saving || !form.description}>{saving ? 'Guardando...' : 'Reportar'}</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
