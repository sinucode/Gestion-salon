'use client'

import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Plus, MapPin, Users, Loader2, Globe, Pencil, Trash2, Palette, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { createClient } from '@/lib/supabase/client'
import { TIMEZONE_OPTIONS } from '@/lib/constants'
import { toast } from 'sonner'
import type { Business } from '@/types'

interface BusinessWithCounts extends Business {
    locations: { count: number }[]
    profiles: { count: number }[]
}

const emptyForm = { name: '', slug: '', nit: '', timezone: 'America/Bogota', logo_url: '', primary_color: '#7c3aed', secondary_color: '#4f46e5', is_active: true }

export default function BusinessesPage() {
    const [businesses, setBusinesses] = useState<BusinessWithCounts[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState(emptyForm)
    const [logoFile, setLogoFile] = useState<File | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const fetchBusinesses = async () => {
        const supabase = createClient()
        const { data } = await supabase.from('businesses').select('*, locations(count), profiles(count)').order('created_at', { ascending: false })
        if (data) setBusinesses(data as unknown as BusinessWithCounts[])
        setLoading(false)
    }

    useEffect(() => { fetchBusinesses() }, [])

    const openCreate = () => { setEditingId(null); setForm(emptyForm); setLogoFile(null); setDialogOpen(true) }
    const openEdit = (biz: Business) => {
        setEditingId(biz.id)
        setForm({ name: biz.name, slug: biz.slug, nit: biz.nit || '', timezone: biz.timezone, logo_url: biz.logo_url || '', primary_color: biz.primary_color || '#7c3aed', secondary_color: biz.secondary_color || '#4f46e5', is_active: biz.is_active })
        setLogoFile(null)
        setDialogOpen(true)
    }
    const openDelete = (id: string) => { setDeleteId(id); setDeleteOpen(true) }

    const handleSave = async () => {
        setSaving(true)
        const supabase = createClient()

        // Handle upload if a new file is chosen
        let finalLogoUrl = form.logo_url
        if (logoFile) {
            const fileExt = logoFile.name.split('.').pop()
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`

            const { error: uploadError } = await supabase.storage
                .from('business_logos')
                .upload(fileName, logoFile, { upsert: true })

            if (uploadError) {
                toast.error('Error subiendo el logo: ' + uploadError.message)
                setSaving(false)
                return
            }

            const { data: publicUrlData } = supabase.storage
                .from('business_logos')
                .getPublicUrl(fileName)

            finalLogoUrl = publicUrlData.publicUrl
        }

        const payload = { ...form, nit: form.nit || null, logo_url: finalLogoUrl || null }

        if (editingId) {
            const { error } = await supabase.from('businesses').update(payload).eq('id', editingId)
            if (error) { toast.error(error.message); setSaving(false); return }
            toast.success('Negocio actualizado')
        } else {
            const { error } = await supabase.from('businesses').insert(payload)
            if (error) { toast.error(error.message); setSaving(false); return }
            toast.success('Negocio creado')
        }
        setSaving(false); setDialogOpen(false); fetchBusinesses()
    }

    const handleDelete = async () => {
        if (!deleteId) return
        const supabase = createClient()
        const { error } = await supabase.from('businesses').update({ is_active: false }).eq('id', deleteId)
        if (error) { toast.error(error.message); return }
        toast.success('Negocio desactivado')
        setDeleteOpen(false); setDeleteId(null); fetchBusinesses()
    }

    if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Negocios</h1>
                    <p className="text-muted-foreground">Administra los negocios registrados en la plataforma</p>
                </div>
                <Button onClick={openCreate} className="gradient-brand text-white"><Plus className="w-4 h-4 mr-2" />Nuevo Negocio</Button>
            </div>

            {businesses.length === 0 ? (
                <Card className="border-border/50 bg-card/80 backdrop-blur-sm"><CardContent className="py-12 text-center"><Building2 className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" /><p className="text-muted-foreground">No hay negocios registrados aún.</p></CardContent></Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {businesses.map((biz) => (
                        <Card key={biz.id} className="group hover:shadow-lg transition-all duration-300 border-border/50 bg-card/80 backdrop-blur-sm">
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        {biz.logo_url ? (
                                            <img src={biz.logo_url} alt={biz.name} className="w-10 h-10 rounded-lg object-cover" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ background: biz.primary_color || '#7c3aed' }}>
                                                {biz.name.substring(0, 2).toUpperCase()}
                                            </div>
                                        )}
                                        <div>
                                            <CardTitle className="text-lg">{biz.name}</CardTitle>
                                            <p className="text-xs text-muted-foreground font-mono">{biz.slug}</p>
                                        </div>
                                    </div>
                                    <Badge variant={biz.is_active ? 'default' : 'secondary'} className="text-xs">{biz.is_active ? 'Activo' : 'Inactivo'}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{biz.locations?.[0]?.count ?? 0} sedes</span>
                                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{biz.profiles?.[0]?.count ?? 0} usuarios</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Globe className="w-3 h-3" />{biz.timezone}
                                    {biz.primary_color && (
                                        <div className="flex items-center gap-1 ml-2">
                                            <Palette className="w-3 h-3" />
                                            <div className="w-3 h-3 rounded-full border" style={{ background: biz.primary_color }} />
                                            <div className="w-3 h-3 rounded-full border" style={{ background: biz.secondary_color || '#4f46e5' }} />
                                        </div>
                                    )}
                                </div>
                                {biz.nit && <p className="text-xs text-muted-foreground">NIT: {biz.nit}</p>}
                                <div className="flex gap-2 pt-2">
                                    <Button variant="outline" size="sm" onClick={() => openEdit(biz)}><Pencil className="w-3 h-3 mr-1" />Editar</Button>
                                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => openDelete(biz.id)}><Trash2 className="w-3 h-3 mr-1" />Desactivar</Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'Editar Negocio' : 'Nuevo Negocio'}</DialogTitle>
                        <DialogDescription>{editingId ? 'Modifica los datos del negocio' : 'Registra un nuevo negocio en la plataforma'}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>Nombre *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Mi Salón" /></div>
                            <div><Label>Slug *</Label><Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="mi-salon" /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>NIT</Label><Input value={form.nit} onChange={e => setForm(f => ({ ...f, nit: e.target.value }))} placeholder="900.123.456-7" /></div>
                            <div>
                                <Label>Zona Horaria</Label>
                                <Select value={form.timezone} onValueChange={(v) => setForm(f => ({ ...f, timezone: v ?? 'America/Bogota' }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>{TIMEZONE_OPTIONS.map(tz => <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label>Logo del Negocio</Label>
                            <div className="mt-1 flex items-center gap-4">
                                {(logoFile || form.logo_url) ? (
                                    <img
                                        src={logoFile ? URL.createObjectURL(logoFile) : form.logo_url}
                                        alt="Preview"
                                        className="w-16 h-16 rounded-lg object-cover border"
                                    />
                                ) : (
                                    <div className="w-16 h-16 rounded-lg border border-dashed flex items-center justify-center bg-muted/50 cursor-pointer text-muted-foreground hover:bg-muted" onClick={() => fileInputRef.current?.click()}>
                                        <Upload className="w-5 h-5" />
                                    </div>
                                )}
                                <div className="flex-1 space-y-2">
                                    <Input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/png, image/jpeg, image/webp"
                                        onChange={e => {
                                            if (e.target.files && e.target.files[0]) {
                                                setLogoFile(e.target.files[0])
                                            }
                                        }}
                                        className="text-xs"
                                    />
                                    <p className="text-xs text-muted-foreground">Recomendado: 256x256px. PNG, JPG o WebP.</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Color Primario</Label>
                                <div className="flex items-center gap-2 mt-1">
                                    <input type="color" value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))} className="w-10 h-10 rounded border cursor-pointer" />
                                    <Input value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))} className="flex-1 uppercase font-mono text-xs" />
                                </div>
                            </div>
                            <div>
                                <Label>Color Secundario</Label>
                                <div className="flex items-center gap-2 mt-1">
                                    <input type="color" value={form.secondary_color} onChange={e => setForm(f => ({ ...f, secondary_color: e.target.value }))} className="w-10 h-10 rounded border cursor-pointer" />
                                    <Input value={form.secondary_color} onChange={e => setForm(f => ({ ...f, secondary_color: e.target.value }))} className="flex-1 uppercase font-mono text-xs" />
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                            <Label>Negocio activo</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={saving || !form.name || !form.slug}>
                            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {saving ? 'Guardando...' : 'Guardar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Desactivar negocio?</AlertDialogTitle>
                        <AlertDialogDescription>El negocio será desactivado. Los usuarios no podrán acceder hasta que se reactive.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Desactivar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
