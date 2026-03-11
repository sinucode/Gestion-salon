'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Layers, Plus, Loader2, Pencil, Trash2, DollarSign, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores'
import { toast } from 'sonner'
import { format_currency } from '@/lib/utils/currency'
import { delete_category, restore_category, delete_service, restore_service } from '@/actions/catalog'

interface CategoryRow { id: string; business_id: string; name: string; description: string | null; sort_order: number; is_active: boolean }
interface ServiceRow { id: string; category_id: string; name: string; description: string | null; price: number; duration_min: number; commission_pct: number; is_active: boolean; category?: { name: string } }

const emptyCat = { name: '', description: '', sort_order: 0, is_active: true }
const emptySvc = { name: '', description: '', price: 0, duration_min: 30, commission_pct: 0, category_id: '', is_active: true }

export default function CatalogPage() {
    const { user, selectedBusinessId } = useAuthStore()
    const isSuperAdmin = user?.role === 'super_admin'
    const filterBusinessId = isSuperAdmin ? selectedBusinessId : user?.business_id

    const [categories, setCategories] = useState<CategoryRow[]>([])
    const [services, setServices] = useState<ServiceRow[]>([])
    const [loading, setLoading] = useState(true)

    // Category dialog
    const [catDialogOpen, setCatDialogOpen] = useState(false)
    const [catEditId, setCatEditId] = useState<string | null>(null)
    const [catForm, setCatForm] = useState(emptyCat)
    const [catDeleteOpen, setCatDeleteOpen] = useState(false)
    const [catDeleteId, setCatDeleteId] = useState<string | null>(null)

    // Service dialog
    const [svcDialogOpen, setSvcDialogOpen] = useState(false)
    const [svcEditId, setSvcEditId] = useState<string | null>(null)
    const [svcForm, setSvcForm] = useState(emptySvc)
    const [svcDeleteOpen, setSvcDeleteOpen] = useState(false)
    const [svcDeleteId, setSvcDeleteId] = useState<string | null>(null)
    const [catRestoreOpen, setCatRestoreOpen] = useState(false)
    const [svcRestoreOpen, setSvcRestoreOpen] = useState(false)
    const [saving, setSaving] = useState(false)

    const fetchData = async () => {
        if (!filterBusinessId) { setLoading(false); return }
        const supabase = createClient()
        const [{ data: cats }, { data: svcs }] = await Promise.all([
            supabase.from('categories').select('*').eq('business_id', filterBusinessId).order('sort_order'),
            supabase.from('services').select('*, category:categories(name)').eq('business_id', filterBusinessId).order('name'),
        ])
        if (cats) setCategories(cats)
        if (svcs) setServices(svcs as unknown as ServiceRow[])
        setLoading(false)
    }

    useEffect(() => { setLoading(true); fetchData() }, [filterBusinessId])

    // Category CRUD
    const openCatCreate = () => { setCatEditId(null); setCatForm(emptyCat); setCatDialogOpen(true) }
    const openCatEdit = (c: CategoryRow) => { setCatEditId(c.id); setCatForm({ name: c.name, description: c.description || '', sort_order: c.sort_order, is_active: c.is_active }); setCatDialogOpen(true) }
    const saveCat = async () => {
        setSaving(true); const supabase = createClient()
        const payload = { ...catForm, description: catForm.description || null }
        if (catEditId) {
            const { error } = await supabase.from('categories').update(payload).eq('id', catEditId)
            if (error) { toast.error(error.message); setSaving(false); return }
            toast.success('Categoría actualizada')
        } else {
            const { error } = await supabase.from('categories').insert({ ...payload, business_id: filterBusinessId! })
            if (error) { toast.error(error.message); setSaving(false); return }
            toast.success('Categoría creada')
        }
        setSaving(false); setCatDialogOpen(false); fetchData()
    }
    const deleteCat = async () => {
        if (!catDeleteId) return
        const result = await delete_category(catDeleteId)
        if (result?.success) { toast.success('Categoría desactivada'); fetchData() }
        setCatDeleteOpen(false); setCatDeleteId(null)
    }
    const restoreCat = async () => {
        if (!catDeleteId) return
        const result = await restore_category(catDeleteId)
        if (result?.success) { toast.success('Categoría restaurada'); fetchData() }
        setCatRestoreOpen(false); setCatDeleteId(null)
    }

    // Service CRUD
    const openSvcCreate = () => { setSvcEditId(null); setSvcForm({ ...emptySvc, category_id: categories[0]?.id || '' }); setSvcDialogOpen(true) }
    const openSvcEdit = (s: ServiceRow) => { setSvcEditId(s.id); setSvcForm({ name: s.name, description: s.description || '', price: s.price, duration_min: s.duration_min, commission_pct: s.commission_pct, category_id: s.category_id, is_active: s.is_active }); setSvcDialogOpen(true) }
    const saveSvc = async () => {
        setSaving(true); const supabase = createClient()
        const payload = { ...svcForm, description: svcForm.description || null, price: Number(svcForm.price), duration_min: Number(svcForm.duration_min), commission_pct: Number(svcForm.commission_pct) }
        if (svcEditId) {
            const { error } = await supabase.from('services').update(payload).eq('id', svcEditId)
            if (error) { toast.error(error.message); setSaving(false); return }
            toast.success('Servicio actualizado')
        } else {
            const { error } = await supabase.from('services').insert({ ...payload, business_id: filterBusinessId! })
            if (error) { toast.error(error.message); setSaving(false); return }
            toast.success('Servicio creado')
        }
        setSaving(false); setSvcDialogOpen(false); fetchData()
    }
    const deleteSvc = async () => {
        if (!svcDeleteId) return
        const result = await delete_service(svcDeleteId)
        if (result?.success) { toast.success('Servicio desactivado'); fetchData() }
        setSvcDeleteOpen(false); setSvcDeleteId(null)
    }
    const restoreSvc = async () => {
        if (!svcDeleteId) return
        const result = await restore_service(svcDeleteId)
        if (result?.success) { toast.success('Servicio restaurado'); fetchData() }
        setSvcRestoreOpen(false); setSvcDeleteId(null)
    }

    if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>

    if (!filterBusinessId && isSuperAdmin) return (
        <div className="space-y-6"><h1 className="text-2xl font-bold">Catálogo</h1>
            <Card className="border-yellow-500/30 bg-yellow-500/5"><CardContent className="py-4 text-sm text-yellow-400 text-center">Selecciona un negocio en el header para ver su catálogo.</CardContent></Card>
        </div>
    )

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold tracking-tight">Catálogo</h1>

            <Tabs defaultValue="categories" className="w-full">
                <TabsList>
                    <TabsTrigger value="categories">Categorías ({categories.length})</TabsTrigger>
                    <TabsTrigger value="services">Servicios ({services.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="categories" className="space-y-4 mt-4">
                    <div className="flex justify-end"><Button onClick={openCatCreate} className="gradient-brand text-white"><Plus className="w-4 h-4 mr-2" />Nueva Categoría</Button></div>
                    {categories.length === 0 ? (
                        <Card className="border-border/50 bg-card/80"><CardContent className="py-12 text-center text-muted-foreground">No hay categorías.</CardContent></Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {categories.map(c => (
                                <Card key={c.id} className={`border-border/50 bg-card/80 backdrop-blur-sm transition-all ${c.is_active ? 'hover:shadow-lg' : 'opacity-60 grayscale-[0.5]'}`}>
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start">
                                            <CardTitle className="text-base">{c.name}</CardTitle>
                                            <Badge variant={c.is_active ? 'default' : 'secondary'} className="text-xs">{c.is_active ? 'ON' : 'OFF'}</Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        {c.description && <p className="text-xs text-muted-foreground mb-3">{c.description}</p>}
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="sm" onClick={() => openCatEdit(c)}><Pencil className="w-3 h-3 mr-1" />Editar</Button>
                                            {c.is_active ? (
                                                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { setCatDeleteId(c.id); setCatDeleteOpen(true) }}><Trash2 className="w-3 h-3" /></Button>
                                            ) : (
                                                <Button variant="ghost" size="sm" className="text-brand" onClick={() => { setCatDeleteId(c.id); setCatRestoreOpen(true) }}><Loader2 className="w-3 h-3" /></Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="services" className="space-y-4 mt-4">
                    <div className="flex justify-end"><Button onClick={openSvcCreate} disabled={categories.length === 0} className="gradient-brand text-white"><Plus className="w-4 h-4 mr-2" />Nuevo Servicio</Button></div>
                    {services.length === 0 ? (
                        <Card className="border-border/50 bg-card/80"><CardContent className="py-12 text-center text-muted-foreground">No hay servicios.</CardContent></Card>
                    ) : (
                        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                            <CardContent className="p-0">
                                <table className="w-full text-sm">
                                    <thead><tr className="border-b border-border/50">
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Servicio</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Categoría</th>
                                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Precio</th>
                                        <th className="text-center py-3 px-4 font-medium text-muted-foreground">Duración</th>
                                        <th className="text-center py-3 px-4 font-medium text-muted-foreground">Comisión</th>
                                        <th className="text-center py-3 px-4 font-medium text-muted-foreground">Acciones</th>
                                    </tr></thead>
                                    <tbody>{services.map(s => (
                                        <tr key={s.id} className={`border-b border-border/20 transition-colors ${s.is_active ? 'hover:bg-muted/30' : 'opacity-60 grayscale-[0.5]'}`}>
                                            <td className="py-3 px-4 font-medium">{s.name}</td>
                                            <td className="py-3 px-4 text-muted-foreground">{s.category?.name || '—'}</td>
                                            <td className="py-3 px-4 text-right font-semibold">{format_currency(s.price)}</td>
                                            <td className="py-3 px-4 text-center"><Badge variant="secondary" className="text-xs"><Clock className="w-3 h-3 mr-1" />{s.duration_min} min</Badge></td>
                                            <td className="py-3 px-4 text-center">{s.commission_pct}%</td>
                                            <td className="py-3 px-4 text-center">
                                                <Button variant="ghost" size="sm" onClick={() => openSvcEdit(s)}><Pencil className="w-3 h-3" /></Button>
                                                {s.is_active ? (
                                                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { setSvcDeleteId(s.id); setSvcDeleteOpen(true) }}><Trash2 className="w-3 h-3" /></Button>
                                                ) : (
                                                    <Button variant="ghost" size="sm" className="text-brand" onClick={() => { setSvcDeleteId(s.id); setSvcRestoreOpen(true) }}><Loader2 className="w-3 h-3" /></Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}</tbody>
                                </table>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>

            {/* Category dialog */}
            <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>{catEditId ? 'Editar' : 'Nueva'} Categoría</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div><Label>Nombre *</Label><Input value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} /></div>
                        <div><Label>Descripción</Label><Textarea value={catForm.description} onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))} /></div>
                        <div><Label>Orden</Label><Input type="number" value={catForm.sort_order} onChange={e => setCatForm(f => ({ ...f, sort_order: Number(e.target.value) }))} /></div>
                        <div className="flex items-center gap-2"><Switch checked={catForm.is_active} onCheckedChange={v => setCatForm(f => ({ ...f, is_active: v }))} /><Label>Activa</Label></div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setCatDialogOpen(false)}>Cancelar</Button><Button onClick={saveCat} disabled={saving || !catForm.name}>{saving ? 'Guardando...' : 'Guardar'}</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Service dialog */}
            <Dialog open={svcDialogOpen} onOpenChange={setSvcDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>{svcEditId ? 'Editar' : 'Nuevo'} Servicio</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div><Label>Nombre *</Label><Input value={svcForm.name} onChange={e => setSvcForm(f => ({ ...f, name: e.target.value }))} /></div>
                        <div><Label>Categoría *</Label>
                            <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={svcForm.category_id} onChange={e => setSvcForm(f => ({ ...f, category_id: e.target.value }))}>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div><Label>Precio *</Label><Input type="number" value={svcForm.price} onChange={e => setSvcForm(f => ({ ...f, price: Number(e.target.value) }))} /></div>
                            <div><Label>Duración (min)</Label><Input type="number" value={svcForm.duration_min} onChange={e => setSvcForm(f => ({ ...f, duration_min: Number(e.target.value) }))} /></div>
                            <div><Label>Comisión %</Label><Input type="number" value={svcForm.commission_pct} onChange={e => setSvcForm(f => ({ ...f, commission_pct: Number(e.target.value) }))} /></div>
                        </div>
                        <div><Label>Descripción</Label><Textarea value={svcForm.description} onChange={e => setSvcForm(f => ({ ...f, description: e.target.value }))} /></div>
                        <div className="flex items-center gap-2"><Switch checked={svcForm.is_active} onCheckedChange={v => setSvcForm(f => ({ ...f, is_active: v }))} /><Label>Activo</Label></div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setSvcDialogOpen(false)}>Cancelar</Button><Button onClick={saveSvc} disabled={saving || !svcForm.name}>{saving ? 'Guardando...' : 'Guardar'}</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete/Restore dialogs */}
            <AlertDialog open={catDeleteOpen} onOpenChange={setCatDeleteOpen}>
                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Desactivar categoría?</AlertDialogTitle></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={deleteCat} className="bg-destructive text-destructive-foreground">Desactivar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={catRestoreOpen} onOpenChange={setCatRestoreOpen}>
                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Restaurar categoría?</AlertDialogTitle></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={restoreCat} className="bg-brand text-primary-foreground">Restaurar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={svcDeleteOpen} onOpenChange={setSvcDeleteOpen}>
                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Desactivar servicio?</AlertDialogTitle></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={deleteSvc} className="bg-destructive text-destructive-foreground">Desactivar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={svcRestoreOpen} onOpenChange={setSvcRestoreOpen}>
                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Restaurar servicio?</AlertDialogTitle></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={restoreSvc} className="bg-brand text-primary-foreground">Restaurar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
