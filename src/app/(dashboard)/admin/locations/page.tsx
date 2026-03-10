'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MapPin, Plus, Loader2, Pencil, Trash2, Phone } from 'lucide-react'
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

interface LocationRow {
    id: string; business_id: string; name: string; address: string | null; phone: string | null; is_active: boolean
    business?: { name: string } | null
}

const emptyForm = { name: '', address: '', phone: '', is_active: true }

export default function LocationsPage() {
    const { user, selectedBusinessId } = useAuthStore()
    const isSuperAdmin = user?.role === 'super_admin'
    const filterBusinessId = isSuperAdmin ? selectedBusinessId : user?.business_id

    const [locations, setLocations] = useState<LocationRow[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState(emptyForm)

    const fetchLocations = async () => {
        const supabase = createClient()
        let query = supabase.from('locations').select('*, business:businesses(name)').order('name')
        if (filterBusinessId) query = query.eq('business_id', filterBusinessId)
        const { data } = await query
        if (data) setLocations(data as unknown as LocationRow[])
        setLoading(false)
    }

    useEffect(() => { setLoading(true); fetchLocations() }, [filterBusinessId])

    const openCreate = () => { setEditingId(null); setForm(emptyForm); setDialogOpen(true) }
    const openEdit = (loc: LocationRow) => {
        setEditingId(loc.id)
        setForm({ name: loc.name, address: loc.address || '', phone: loc.phone || '', is_active: loc.is_active })
        setDialogOpen(true)
    }
    const openDelete = (id: string) => { setDeleteId(id); setDeleteOpen(true) }

    const handleSave = async () => {
        if (!filterBusinessId && !editingId) { toast.error('Selecciona un negocio primero'); return }
        setSaving(true)
        const supabase = createClient()
        const payload = { ...form, address: form.address || null, phone: form.phone || null }

        if (editingId) {
            const { error } = await supabase.from('locations').update(payload).eq('id', editingId)
            if (error) { toast.error(error.message); setSaving(false); return }
            toast.success('Sede actualizada')
        } else {
            const { error } = await supabase.from('locations').insert({ ...payload, business_id: filterBusinessId! })
            if (error) { toast.error(error.message); setSaving(false); return }
            toast.success('Sede creada')
        }
        setSaving(false); setDialogOpen(false); fetchLocations()
    }

    const handleDelete = async () => {
        if (!deleteId) return
        const supabase = createClient()
        const { error } = await supabase.from('locations').update({ is_active: false }).eq('id', deleteId)
        if (error) { toast.error(error.message); return }
        toast.success('Sede desactivada')
        setDeleteOpen(false); setDeleteId(null); fetchLocations()
    }

    if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Sedes</h1>
                    <p className="text-muted-foreground">Gestiona las sedes del negocio</p>
                </div>
                <Button onClick={openCreate} disabled={!filterBusinessId} className="gradient-brand text-white"><Plus className="w-4 h-4 mr-2" />Nueva Sede</Button>
            </div>

            {!filterBusinessId && isSuperAdmin && (
                <Card className="border-yellow-500/30 bg-yellow-500/5"><CardContent className="py-4 text-sm text-yellow-400 text-center">Selecciona un negocio en el header para ver sus sedes.</CardContent></Card>
            )}

            {locations.length === 0 && filterBusinessId ? (
                <Card className="border-border/50 bg-card/80 backdrop-blur-sm"><CardContent className="py-12 text-center"><MapPin className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" /><p className="text-muted-foreground">No hay sedes registradas.</p></CardContent></Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {locations.map((loc) => (
                        <Card key={loc.id} className="group hover:shadow-lg transition-all duration-300 border-border/50 bg-card/80 backdrop-blur-sm">
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <CardTitle className="text-lg flex items-center gap-2"><MapPin className="w-4 h-4 text-violet-500" />{loc.name}</CardTitle>
                                    <Badge variant={loc.is_active ? 'default' : 'secondary'} className="text-xs">{loc.is_active ? 'Activa' : 'Inactiva'}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {loc.business?.name && <p className="text-xs text-muted-foreground">🏢 {loc.business.name}</p>}
                                {loc.address && <p className="text-sm text-muted-foreground">{loc.address}</p>}
                                {loc.phone && <p className="text-sm text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{loc.phone}</p>}
                                <div className="flex gap-2 pt-2">
                                    <Button variant="outline" size="sm" onClick={() => openEdit(loc)}><Pencil className="w-3 h-3 mr-1" />Editar</Button>
                                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => openDelete(loc.id)}><Trash2 className="w-3 h-3 mr-1" />Desactivar</Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'Editar Sede' : 'Nueva Sede'}</DialogTitle>
                        <DialogDescription>{editingId ? 'Modifica los datos de la sede' : 'Registra una nueva sede'}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div><Label>Nombre *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Sede Principal" /></div>
                        <div><Label>Dirección</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Calle 123 #45-67" /></div>
                        <div><Label>Teléfono</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+57 300 123 4567" /></div>
                        <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} /><Label>Sede activa</Label></div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={saving || !form.name}>{saving ? 'Guardando...' : 'Guardar'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>¿Desactivar sede?</AlertDialogTitle><AlertDialogDescription>La sede será desactivada y no será visible para los usuarios.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Desactivar</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
