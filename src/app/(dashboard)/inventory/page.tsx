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
import { cn } from '@/lib/utils'

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
                <Card className="border-border/50 bg-card/80">
                    <CardContent className="py-12 text-center">
                        <Package className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                        <p className="text-muted-foreground">No hay productos.</p>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Desktop View Table */}
                    <Card className="border-border/50 bg-card/80 backdrop-blur-sm hidden md:block overflow-hidden">
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead><tr className="border-b border-border/50">
                                        <th className="text-left py-4 px-6 font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">Producto</th>
                                        <th className="text-left py-4 px-6 font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">SKU</th>
                                        <th className="text-center py-4 px-6 font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">Unidad</th>
                                        <th className="text-right py-4 px-6 font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">Costo</th>
                                        <th className="text-right py-4 px-6 font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">Venta</th>
                                        <th className="text-center py-4 px-6 font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">Stock</th>
                                        <th className="text-right py-4 px-6 font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">Acciones</th>
                                    </tr></thead>
                                    <tbody className="divide-y divide-border/20">{products.map(p => {
                                        const isLow = p.stock_qty <= p.min_stock
                                        return (
                                            <tr key={p.id} className={`transition-colors h-16 ${p.is_active ? 'hover:bg-muted/30' : 'opacity-60 grayscale-[0.5]'}`}>
                                                <td className="py-3 px-6 font-bold text-foreground">{p.name}</td>
                                                <td className="py-3 px-6 text-muted-foreground font-mono text-xs">{p.sku || '—'}</td>
                                                <td className="py-3 px-6 text-center">{p.unit}</td>
                                                <td className="py-3 px-6 text-right">{format_currency(p.cost_price)}</td>
                                                <td className="py-3 px-6 text-right font-bold text-primary">{format_currency(p.sell_price)}</td>
                                                <td className="py-3 px-6 text-center">
                                                    <Badge variant={isLow ? 'destructive' : 'secondary'} className="text-[10px] uppercase font-bold tracking-wider rounded-full px-2">
                                                        {isLow && <AlertTriangle className="w-2.5 h-2.5 mr-1" />}
                                                        {p.stock_qty} / {p.min_stock}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 px-6 text-right space-x-1">
                                                    <Button variant="ghost" size="icon-sm" className="hover:bg-brand/10 hover:text-brand" onClick={() => openEdit(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                                                    {p.is_active ? (
                                                        <Button variant="ghost" size="icon-sm" className="text-destructive hover:bg-destructive/10" onClick={() => { setTargetId(p.id); setDeleteOpen(true) }}><Trash2 className="w-3.5 h-3.5" /></Button>
                                                    ) : (
                                                        <Button variant="ghost" size="icon-sm" className="text-brand hover:bg-brand/10" onClick={() => { setTargetId(p.id); setRestoreOpen(true) }}><Loader2 className="w-3.5 h-3.5 animate-spin" /></Button>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}</tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Mobile View Cards */}
                    <div className="grid grid-cols-1 gap-4 md:hidden">
                        {products.map(p => {
                            const isLow = p.stock_qty <= p.min_stock
                            return (
                                <Card key={p.id} className={cn("border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden", !p.is_active && "opacity-60 grayscale-[0.3]")}>
                                    <CardContent className="p-5 space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="font-bold text-lg leading-none">{p.name}</h3>
                                                <p className="text-[10px] text-muted-foreground font-mono mt-1">{p.sku || 'Sin SKU'}</p>
                                            </div>
                                            <Badge variant={isLow ? 'destructive' : 'secondary'} className="rounded-full animate-in fade-in zoom-in duration-300">
                                                {isLow && <AlertTriangle className="w-3 h-3 mr-1" />}
                                                Stock: {p.stock_qty}
                                            </Badge>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-sm pt-2">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] uppercase text-muted-foreground tracking-widest font-bold">Costo</span>
                                                <span className="font-medium">{format_currency(p.cost_price)}</span>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] uppercase text-muted-foreground tracking-widest font-bold">Venta</span>
                                                <span className="font-bold text-primary">{format_currency(p.sell_price)}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between pt-4 border-t border-border/30">
                                            <span className="text-xs text-muted-foreground italic">Unidad: {p.unit}</span>
                                            <div className="flex gap-2">
                                                <Button variant="outline" size="sm" className="h-9 px-4 rounded-full" onClick={() => openEdit(p)}>
                                                    <Pencil className="w-3.5 h-3.5 mr-2" /> Editar
                                                </Button>
                                                {p.is_active ? (
                                                    <Button variant="ghost" size="icon-sm" className="h-9 w-9 text-destructive rounded-full hover:bg-destructive/10" onClick={() => { setTargetId(p.id); setDeleteOpen(true) }}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                ) : (
                                                    <Button variant="ghost" size="icon-sm" className="h-9 w-9 text-brand rounded-full hover:bg-brand/10" onClick={() => { setTargetId(p.id); setRestoreOpen(true) }}>
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                </>
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
