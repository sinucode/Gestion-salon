'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Users as UsersIcon, Plus, Loader2, Pencil, Shield, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores'
import { toast } from 'sonner'

interface ProfileRow {
    id: string; first_name: string; last_name: string; email?: string; role: string
    phone: string | null; document_id: string | null; is_active: boolean; business_id: string | null
}

const ROLE_LABELS: Record<string, string> = { super_admin: '🛡️ Super Admin', admin: '👔 Admin', professional: '✂️ Profesional', client: '👤 Cliente' }
const ROLE_COLORS: Record<string, string> = { super_admin: 'bg-violet-500/10 text-violet-500', admin: 'bg-blue-500/10 text-blue-500', professional: 'bg-green-500/10 text-green-500', client: 'bg-gray-500/10 text-gray-400' }

const emptyForm = { first_name: '', last_name: '', email: '', phone: '', document_id: '', role: 'client', is_active: true }

export default function UsersPage() {
    const { user, selectedBusinessId } = useAuthStore()
    const isSuperAdmin = user?.role === 'super_admin'
    const filterBusinessId = isSuperAdmin ? selectedBusinessId : user?.business_id

    const [profiles, setProfiles] = useState<ProfileRow[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState(emptyForm)

    const fetchProfiles = async () => {
        const supabase = createClient()
        let query = supabase.from('profiles').select('*').order('first_name')
        if (filterBusinessId) query = query.eq('business_id', filterBusinessId)
        const { data } = await query
        if (data) setProfiles(data as ProfileRow[])
        setLoading(false)
    }

    useEffect(() => { setLoading(true); fetchProfiles() }, [filterBusinessId])

    const openEdit = (p: ProfileRow) => {
        setEditingId(p.id)
        setForm({ first_name: p.first_name, last_name: p.last_name, email: '', phone: p.phone || '', document_id: p.document_id || '', role: p.role, is_active: p.is_active })
        setDialogOpen(true)
    }

    const handleSave = async () => {
        setSaving(true)
        const supabase = createClient()
        if (editingId) {
            const { error } = await supabase.from('profiles').update({
                first_name: form.first_name, last_name: form.last_name, phone: form.phone || null,
                document_id: form.document_id || null, role: form.role, is_active: form.is_active,
            }).eq('id', editingId)
            if (error) { toast.error(error.message); setSaving(false); return }
            toast.success('Usuario actualizado')
        }
        setSaving(false); setDialogOpen(false); fetchProfiles()
    }

    if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
                    <p className="text-muted-foreground">Gestiona los usuarios del negocio</p>
                </div>
            </div>

            {!filterBusinessId && isSuperAdmin && (
                <Card className="border-yellow-500/30 bg-yellow-500/5"><CardContent className="py-4 text-sm text-yellow-400 text-center">Selecciona un negocio en el header para ver sus usuarios.</CardContent></Card>
            )}

            {profiles.length === 0 && filterBusinessId ? (
                <Card className="border-border/50 bg-card/80 backdrop-blur-sm"><CardContent className="py-12 text-center"><UsersIcon className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" /><p className="text-muted-foreground">No hay usuarios registrados.</p></CardContent></Card>
            ) : (
                <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead><tr className="border-b border-border/50">
                                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Nombre</th>
                                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Teléfono</th>
                                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Documento</th>
                                    <th className="text-center py-3 px-4 text-muted-foreground font-medium">Rol</th>
                                    <th className="text-center py-3 px-4 text-muted-foreground font-medium">Estado</th>
                                    <th className="text-center py-3 px-4 text-muted-foreground font-medium">Acciones</th>
                                </tr></thead>
                                <tbody>
                                    {profiles.map(p => (
                                        <tr key={p.id} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                                            <td className="py-3 px-4"><div className="font-medium">{p.first_name} {p.last_name}</div></td>
                                            <td className="py-3 px-4 text-muted-foreground">{p.phone || '—'}</td>
                                            <td className="py-3 px-4 text-muted-foreground">{p.document_id || '—'}</td>
                                            <td className="py-3 px-4 text-center"><Badge className={`text-xs ${ROLE_COLORS[p.role] || ''}`}>{ROLE_LABELS[p.role] || p.role}</Badge></td>
                                            <td className="py-3 px-4 text-center"><Badge variant={p.is_active ? 'default' : 'secondary'} className="text-xs">{p.is_active ? 'Activo' : 'Inactivo'}</Badge></td>
                                            <td className="py-3 px-4 text-center"><Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Pencil className="w-3 h-3" /></Button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Editar Usuario</DialogTitle><DialogDescription>Modifica los datos del usuario</DialogDescription></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>Nombre *</Label><Input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} /></div>
                            <div><Label>Apellido *</Label><Input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>Teléfono</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                            <div><Label>Documento</Label><Input value={form.document_id} onChange={e => setForm(f => ({ ...f, document_id: e.target.value }))} /></div>
                        </div>
                        <div>
                            <Label>Rol</Label>
                            <Select value={form.role} onValueChange={(v) => setForm(f => ({ ...f, role: v ?? 'client' }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="admin">👔 Administrador</SelectItem>
                                    <SelectItem value="professional">✂️ Profesional</SelectItem>
                                    <SelectItem value="client">👤 Cliente</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} /><Label>Usuario activo</Label></div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={saving || !form.first_name}>{saving ? 'Guardando...' : 'Guardar'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
