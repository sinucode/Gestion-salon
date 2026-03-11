'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Users as UsersIcon, Loader2, Pencil, Mail, KeyRound, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores'
import { toast } from 'sonner'
import { fetchUserEmails, adminUpdateUserEmail, adminResetUserPassword } from '@/actions/users'

interface ProfileRow {
    id: string; first_name: string; last_name: string; email?: string; role: string
    phone: string | null; document_id: string | null; is_active: boolean; business_id: string | null
}

const ROLE_LABELS: Record<string, string> = { super_admin: '🛡️ Super Admin', admin: '👔 Admin', professional: '✂️ Profesional', client: '👤 Cliente' }
const ROLE_COLORS: Record<string, string> = { super_admin: 'bg-violet-500/10 text-violet-500', admin: 'bg-blue-500/10 text-blue-500', professional: 'bg-green-500/10 text-green-500', client: 'bg-gray-500/10 text-gray-400' }
const ROLE_RANK: Record<string, number> = { super_admin: 4, admin: 3, professional: 2, client: 1 }

const emptyForm = { first_name: '', last_name: '', email: '', phone: '', document_id: '', role: 'client', is_active: true }

export default function UsersPage() {
    const { user, selectedBusinessId } = useAuthStore()
    const isSuperAdmin = user?.role === 'super_admin'
    const isAdmin = user?.role === 'admin'
    const canManageCredentials = isSuperAdmin || isAdmin
    const filterBusinessId = isSuperAdmin ? selectedBusinessId : user?.business_id

    const [profiles, setProfiles] = useState<ProfileRow[]>([])
    const [emailMap, setEmailMap] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingRole, setEditingRole] = useState<string>('')
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState(emptyForm)

    // Credential fields
    const [newEmail, setNewEmail] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [savingEmail, setSavingEmail] = useState(false)
    const [savingPassword, setSavingPassword] = useState(false)

    const callerRank = ROLE_RANK[user?.role || ''] || 0

    const fetchProfiles = useCallback(async () => {
        const supabase = createClient()
        let query = supabase.from('profiles').select('*').order('first_name')
        if (filterBusinessId) query = query.eq('business_id', filterBusinessId)
        const { data } = await query
        if (data) {
            setProfiles(data as ProfileRow[])
            // Fetch emails if admin+
            if (canManageCredentials && data.length > 0) {
                const ids = data.map((p: ProfileRow) => p.id)
                const result = await fetchUserEmails(ids)
                if (result.data) setEmailMap(result.data)
            }
        }
        setLoading(false)
    }, [filterBusinessId, canManageCredentials])

    useEffect(() => { setLoading(true); fetchProfiles() }, [fetchProfiles])

    const canEditTarget = (targetRole: string): boolean => {
        const targetRank = ROLE_RANK[targetRole] || 0
        return callerRank > targetRank
    }

    const openEdit = (p: ProfileRow) => {
        setEditingId(p.id)
        setEditingRole(p.role)
        setForm({
            first_name: p.first_name,
            last_name: p.last_name,
            email: emailMap[p.id] || '',
            phone: p.phone || '',
            document_id: p.document_id || '',
            role: p.role,
            is_active: p.is_active,
        })
        setNewEmail('')
        setNewPassword('')
        setShowPassword(false)
        setDialogOpen(true)
    }

    const handleSave = async () => {
        if (!editingId) return
        setSaving(true)
        const supabase = createClient()
        const { error } = await supabase.from('profiles').update({
            first_name: form.first_name, last_name: form.last_name, phone: form.phone || null,
            document_id: form.document_id || null, role: form.role, is_active: form.is_active,
        }).eq('id', editingId)
        if (error) { toast.error(error.message); setSaving(false); return }
        toast.success('Usuario actualizado')
        setSaving(false); setDialogOpen(false); fetchProfiles()
    }

    const handleUpdateEmail = async () => {
        if (!editingId || !newEmail) return
        setSavingEmail(true)
        const result = await adminUpdateUserEmail(editingId, newEmail)
        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success('Email actualizado correctamente')
            setEmailMap(prev => ({ ...prev, [editingId]: newEmail }))
            setNewEmail('')
        }
        setSavingEmail(false)
    }

    const handleResetPassword = async () => {
        if (!editingId || !newPassword) return
        setSavingPassword(true)
        const result = await adminResetUserPassword(editingId, newPassword)
        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success('Contraseña actualizada correctamente')
            setNewPassword('')
        }
        setSavingPassword(false)
    }

    const showCredentialSection = canManageCredentials && editingId && canEditTarget(editingRole)

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
                                    {canManageCredentials && <th className="text-left py-3 px-4 text-muted-foreground font-medium">Email (Login)</th>}
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
                                            {canManageCredentials && (
                                                <td className="py-3 px-4 text-muted-foreground">
                                                    <div className="flex items-center gap-1.5">
                                                        <Mail className="w-3 h-3 text-muted-foreground/50" />
                                                        <span className="text-xs">{emailMap[p.id] || '—'}</span>
                                                    </div>
                                                </td>
                                            )}
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
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Editar Usuario</DialogTitle>
                        <DialogDescription>Modifica los datos del usuario</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        {/* Current email display */}
                        {canManageCredentials && form.email && (
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/30">
                                <Mail className="w-4 h-4 text-muted-foreground" />
                                <div>
                                    <p className="text-xs text-muted-foreground">Login actual</p>
                                    <p className="text-sm font-medium">{form.email}</p>
                                </div>
                            </div>
                        )}

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
                                    {isSuperAdmin && <SelectItem value="admin">👔 Administrador</SelectItem>}
                                    <SelectItem value="professional">✂️ Profesional</SelectItem>
                                    <SelectItem value="client">👤 Cliente</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} /><Label>Usuario activo</Label></div>

                        {/* Credential management section — only for admin+ editing lower-rank users */}
                        {showCredentialSection && (
                            <>
                                <Separator className="my-1" />
                                <p className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                                    <KeyRound className="w-4 h-4" /> Gestión de Credenciales
                                </p>

                                {/* Change email */}
                                <div>
                                    <Label>Nuevo Email (Login)</Label>
                                    <div className="flex gap-2 mt-1">
                                        <Input
                                            type="email"
                                            placeholder="nuevo@correo.com"
                                            value={newEmail}
                                            onChange={e => setNewEmail(e.target.value)}
                                            className="flex-1"
                                        />
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handleUpdateEmail}
                                            disabled={savingEmail || !newEmail}
                                            className="shrink-0"
                                        >
                                            {savingEmail ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3 mr-1" />}
                                            Cambiar
                                        </Button>
                                    </div>
                                </div>

                                {/* Change password */}
                                <div>
                                    <Label>Nueva Contraseña</Label>
                                    <div className="flex gap-2 mt-1">
                                        <div className="relative flex-1">
                                            <Input
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder="Mínimo 8 caracteres"
                                                value={newPassword}
                                                onChange={e => setNewPassword(e.target.value)}
                                            />
                                            <button
                                                type="button"
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                                onClick={() => setShowPassword(!showPassword)}
                                            >
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handleResetPassword}
                                            disabled={savingPassword || !newPassword || newPassword.length < 8}
                                            className="shrink-0"
                                        >
                                            {savingPassword ? <Loader2 className="w-3 h-3 animate-spin" /> : <KeyRound className="w-3 h-3 mr-1" />}
                                            Cambiar
                                        </Button>
                                    </div>
                                    {newPassword.length > 0 && newPassword.length < 8 && (
                                        <p className="text-xs text-destructive mt-1">Mínimo 8 caracteres</p>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={saving || !form.first_name}>{saving ? 'Guardando...' : 'Guardar Perfil'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
