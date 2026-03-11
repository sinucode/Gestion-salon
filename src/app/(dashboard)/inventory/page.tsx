'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Package, Plus, Loader2, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores'
import { toast } from 'sonner'
import { format_currency } from '@/lib/utils/currency'
import { delete_product, restore_product } from '@/actions/inventory'

interface ProductRow { id: string; name: string; sku: string | null; unit: string; cost_price: number; sell_price: number; stock_qty: number; min_stock: number; is_active: boolean }

const emptyForm = { name: '', sku: '', unit: 'ml', cost_price: 0, sell_price: 0, stock_qty: 0, min_stock: 5, is_active: true }

export default function InventoryPage() {
    const { user, selectedBusinessId, selectedLocationIds } = useAuthStore()
    const isSuperAdmin = user?.role === 'super_admin'
    const filterBusinessId = isSuperAdmin ? selectedBusinessId : user?.business_id

    const [products, setProducts] = useState<ProductRow[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [restoreOpen, setRestoreOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [targetId, setTargetId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState(emptyForm)

    const fetchProducts = async () => {
        if (!filterBusinessId) { setLoading(false); return }
        const supabase = createClient()
        let query = supabase.from('products').select('*').eq('business_id', filterBusinessId)
        
        let queryLocs = selectedLocationIds.map(id => id.replace(/['"]/g, ''))
        if (queryLocs.length > 0) query = query.in('location_id', queryLocs)
        
        query = query.order('name')
        const { data } = await query
        if (data) setProducts(data as ProductRow[])
        setLoading(false)
    }

    useEffect(() => { setLoading(true); fetchProducts() }, [filterBusinessId, selectedLocationIds])

    const openCreate = () => { setEditingId(null); setForm(emptyForm); setDialogOpen(true) }
    const openEdit = (p: ProductRow) => {
        setEditingId(p.id)
        setForm({ name: p.name, sku: p.sku || '', unit: p.unit, cost_price: p.cost_price, sell_price: p.sell_price, stock_qty: p.stock_qty, min_stock: p.min_stock, is_active: p.is_active })
        setDialogOpen(true)
    }

    const handleSave = async () => {
        setSaving(true); const supabase = createClient()
        const payload = { ...form, sku: form.sku || null, cost_price: Number(form.cost_price), sell_price: Number(form.sell_price), stock_qty: Number(form.stock_qty), min_stock: Number(form.min_stock) }
        if (editingId) {
            const { error } = await supabase.from('products').update(payload).eq('id', editingId)
            if (error) { toast.error(error.message); setSaving(false); return }
            toast.success('Producto actualizado')
        } else {
            if (selectedLocationIds.length !== 1) { toast.error('Selecciona una única sede física en el filtro superior para crear productos.'); setSaving(false); return }
            const activeLocId = selectedLocationIds[0].replace(/['"]/g, '')
            const { error } = await supabase.from('products').insert({ ...payload, business_id: filterBusinessId!, location_id: activeLocId })
            if (error) { toast.error(error.message); setSaving(false); return }
            toast.success('Producto creado')
        }
        setSaving(false); setDialogOpen(false); fetchProducts()
    }

    const handleDelete = async () => {
        if (!targetId) return
        const result = await delete_product(targetId)
        if (result?.success) { toast.success('Producto desactivado'); fetchProducts() }
        setDeleteOpen(false); setTargetId(null)
    }

    const handleRestore = async () => {
        if (!targetId) return
        const result = await restore_product(targetId)
        if (result?.success) { toast.success('Producto restaurado'); fetchProducts() }
        setRestoreOpen(false); setTargetId(null)
    }

    if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>

    if (!filterBusinessId && isSuperAdmin) return (
        <div className="space-y-6"><h1 className="text-2xl font-bold">Inventario</h1>
            <Card className="border-yellow-500/30 bg-yellow-500/5"><CardContent className="py-4 text-sm text-yellow-400 text-center">Selecciona un negocio en el header para ver su inventario.</CardContent></Card>
        </div>
    )

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div><h1 className="text-2xl font-bold tracking-tight">Inventario</h1><p className="text-muted-foreground">Gestiona los productos y stock</p></div>
                <Button onClick={openCreate} className="gradient-brand text-white"><Plus className="w-4 h-4 mr-2" />Nuevo Producto</Button>
            </div>

            {products.length === 0 ? (
                <Card className="border-border/50 bg-card/80"><CardContent className="py-12 text-center"><Package className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" /><p className="text-muted-foreground">No hay productos.</p></CardContent></Card>
            ) : (
                <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                    <CardContent className="p-0">
                        <table className="w-full text-sm">
                            <thead><tr className="border-b border-border/50">
                                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Producto</th>
                                <th className="text-left py-3 px-4 font-medium text-muted-foreground">SKU</th>
                                <th className="text-center py-3 px-4 font-medium text-muted-foreground">Unidad</th>
                                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Costo</th>
                                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Venta</th>
                                <th className="text-center py-3 px-4 font-medium text-muted-foreground">Stock</th>
                                <th className="text-center py-3 px-4 font-medium text-muted-foreground">Acciones</th>
                            </tr></thead>
                            <tbody>{products.map(p => {
                                const isLow = p.stock_qty <= p.min_stock
                                return (
                                    <tr key={p.id} className={`border-b border-border/20 transition-colors ${p.is_active ? 'hover:bg-muted/30' : 'opacity-60 grayscale-[0.5]'}`}>
                                        <td className="py-3 px-4 font-medium">{p.name}</td>
                                        <td className="py-3 px-4 text-muted-foreground font-mono text-xs">{p.sku || '—'}</td>
                                        <td className="py-3 px-4 text-center">{p.unit}</td>
                                        <td className="py-3 px-4 text-right">{format_currency(p.cost_price)}</td>
                                        <td className="py-3 px-4 text-right font-semibold">{format_currency(p.sell_price)}</td>
                                        <td className="py-3 px-4 text-center">
                                            <Badge variant={isLow ? 'destructive' : 'secondary'} className="text-xs">
                                                {isLow && <AlertTriangle className="w-3 h-3 mr-1" />}
                                                {p.stock_qty} / {p.min_stock}
                                            </Badge>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Pencil className="w-3 h-3" /></Button>
                                            {p.is_active ? (
                                                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { setTargetId(p.id); setDeleteOpen(true) }}><Trash2 className="w-3 h-3" /></Button>
                                            ) : (
                                                <Button variant="ghost" size="sm" className="text-brand" onClick={() => { setTargetId(p.id); setRestoreOpen(true) }}><Loader2 className="w-3 h-3" /></Button>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}</tbody>
                        </table>
                    </CardContent>
                </Card>
            )}

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>{editingId ? 'Editar' : 'Nuevo'} Producto</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>Nombre *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                            <div><Label>SKU</Label><Input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} /></div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div><Label>Unidad</Label><Input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="ml, g, unidad" /></div>
                            <div><Label>Precio Costo</Label><Input type="number" value={form.cost_price} onChange={e => setForm(f => ({ ...f, cost_price: Number(e.target.value) }))} /></div>
                            <div><Label>Precio Venta</Label><Input type="number" value={form.sell_price} onChange={e => setForm(f => ({ ...f, sell_price: Number(e.target.value) }))} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>Stock Actual</Label><Input type="number" value={form.stock_qty} onChange={e => setForm(f => ({ ...f, stock_qty: Number(e.target.value) }))} /></div>
                            <div><Label>Stock Mínimo</Label><Input type="number" value={form.min_stock} onChange={e => setForm(f => ({ ...f, min_stock: Number(e.target.value) }))} /></div>
                        </div>
                        <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} /><Label>Activo</Label></div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button onClick={handleSave} disabled={saving || !form.name}>{saving ? 'Guardando...' : 'Guardar'}</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Desactivar producto?</AlertDialogTitle></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Desactivar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={restoreOpen} onOpenChange={setRestoreOpen}>
                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Restaurar producto?</AlertDialogTitle></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleRestore} className="bg-brand text-primary-foreground">Restaurar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
