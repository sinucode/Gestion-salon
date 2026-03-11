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
import { useAuthStore } from '@/stores'
import { toast } from 'sonner'
import {
    list_users_filtered,
    fetch_user_emails,
    admin_update_user_email,
    admin_reset_user_password,
    admin_update_profile,
    type ProfileListRow,
} from '@/actions/users'

const ROLE_LABELS: Record<string, string> = { super_admin: '🛡️ Super Admin', admin: '👔 Admin', professional: '✂️ Profesional', client: '👤 Cliente' }
const ROLE_COLORS: Record<string, string> = { super_admin: 'bg-violet-500/10 text-violet-500', admin: 'bg-blue-500/10 text-blue-500', professional: 'bg-green-500/10 text-green-500', client: 'bg-gray-500/10 text-gray-400' }
const ROLE_RANK: Record<string, number> = { super_admin: 4, admin: 3, professional: 2, client: 1 }

const empty_form = { first_name: '', last_name: '', email: '', phone: '', document_id: '', role: 'client', is_active: true }

export default function UsersPage() {
    const { user, selectedBusinessId } = useAuthStore()
    const is_super_admin = user?.role === 'super_admin'
    const is_admin = user?.role === 'admin'
    const can_manage_credentials = is_super_admin || is_admin
    const filter_business_id = is_super_admin ? selectedBusinessId : user?.business_id

    const [profiles, setProfiles] = useState<ProfileListRow[]>([])
    const [email_map, setEmailMap] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)
    const [dialog_open, setDialogOpen] = useState(false)
    const [editing_id, setEditingId] = useState<string | null>(null)
    const [editing_role, setEditingRole] = useState<string>('')
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState(empty_form)

    // Credential fields
    const [new_email, setNewEmail] = useState('')
    const [new_password, setNewPassword] = useState('')
    const [show_password, setShowPassword] = useState(false)
    const [saving_email, setSavingEmail] = useState(false)
    const [saving_password, setSavingPassword] = useState(false)

    const caller_rank = ROLE_RANK[user?.role || ''] || 0

    // Fetch profiles via server action (not direct client query)
    const fetch_profiles = useCallback(async () => {
        const result = await list_users_filtered(filter_business_id)
        if (result.error) {
            toast.error(result.error)
            setLoading(false)
            return
        }
        const data = result.data ?? []
        setProfiles(data)

        // Fetch emails if admin+
        if (can_manage_credentials && data.length > 0) {
            const ids = data.map((p) => p.id)
            const email_result = await fetch_user_emails(ids)
            if (email_result.data) setEmailMap(email_result.data)
        }
        setLoading(false)
    }, [filter_business_id, can_manage_credentials])

    useEffect(() => { setLoading(true); fetch_profiles() }, [fetch_profiles])

    const can_edit_target = (target_role: string): boolean => {
        const target_rank = ROLE_RANK[target_role] || 0
        return caller_rank > target_rank
    }

    const open_edit = (p: ProfileListRow) => {
        setEditingId(p.id)
        setEditingRole(p.role)
        setForm({
            first_name: p.first_name,
            last_name: p.last_name,
            email: email_map[p.id] || '',
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

    // Save profile via server action
    const handle_save = async () => {
        if (!editing_id) return
        setSaving(true)
        const result = await admin_update_profile(editing_id, {
            first_name: form.first_name,
            last_name: form.last_name,
            phone: form.phone || null,
            document_id: form.document_id || null,
            role: form.role,
            is_active: form.is_active,
        })
        if (result.error) { toast.error(result.error); setSaving(false); return }
        toast.success('Usuario actualizado')
        setSaving(false); setDialogOpen(false); fetch_profiles()
    }

    const handle_update_email = async () => {
        if (!editing_id || !new_email) return
        setSavingEmail(true)
        const result = await admin_update_user_email(editing_id, new_email)
        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success('Email actualizado correctamente')
            setEmailMap(prev => ({ ...prev, [editing_id]: new_email }))
            setNewEmail('')
        }
        setSavingEmail(false)
    }

    const handle_reset_password = async () => {
        if (!editing_id || !new_password) return
        setSavingPassword(true)
        const result = await admin_reset_user_password(editing_id, new_password)
        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success('Contraseña actualizada correctamente')
            setNewPassword('')
        }
        setSavingPassword(false)
    }

    const show_credential_section = can_manage_credentials && editing_id && can_edit_target(editing_role)

    if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
                    <p className="text-muted-foreground">Gestiona los usuarios del negocio</p>
                </div>
            </div>

            {!filter_business_id && is_super_admin && (
                <Card className="border-yellow-500/30 bg-yellow-500/5"><CardContent className="py-4 text-sm text-yellow-400 text-center">Selecciona un negocio en el header para ver sus usuarios.</CardContent></Card>
            )}

            {profiles.length === 0 && filter_business_id ? (
                <Card className="border-border/50 bg-card/80 backdrop-blur-sm"><CardContent className="py-12 text-center"><UsersIcon className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" /><p className="text-muted-foreground">No hay usuarios registrados.</p></CardContent></Card>
            ) : (
                <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead><tr className="border-b border-border/50">
                                    <th className="text-left py-3 px-4 text-muted-foreground font-medium">Nombre</th>
                                    {can_manage_credentials && <th className="text-left py-3 px-4 text-muted-foreground font-medium">Email (Login)</th>}
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
                                            {can_manage_credentials && (
                                                <td className="py-3 px-4 text-muted-foreground">
                                                    <div className="flex items-center gap-1.5">
                                                        <Mail className="w-3 h-3 text-muted-foreground/50" />
                                                        <span className="text-xs">{email_map[p.id] || '—'}</span>
                                                    </div>
                                                </td>
                                            )}
                                            <td className="py-3 px-4 text-muted-foreground">{p.phone || '—'}</td>
                                            <td className="py-3 px-4 text-muted-foreground">{p.document_id || '—'}</td>
                                            <td className="py-3 px-4 text-center"><Badge className={`text-xs ${ROLE_COLORS[p.role] || ''}`}>{ROLE_LABELS[p.role] || p.role}</Badge></td>
                                            <td className="py-3 px-4 text-center"><Badge variant={p.is_active ? 'default' : 'secondary'} className="text-xs">{p.is_active ? 'Activo' : 'Inactivo'}</Badge></td>
                                            <td className="py-3 px-4 text-center"><Button variant="ghost" size="sm" onClick={() => open_edit(p)}><Pencil className="w-3 h-3" /></Button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Dialog open={dialog_open} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Editar Usuario</DialogTitle>
                        <DialogDescription>Modifica los datos del usuario</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        {/* Current email display */}
                        {can_manage_credentials && form.email && (
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
                                    {is_super_admin && <SelectItem value="admin">👔 Administrador</SelectItem>}
                                    <SelectItem value="professional">✂️ Profesional</SelectItem>
                                    <SelectItem value="client">👤 Cliente</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} /><Label>Usuario activo</Label></div>

                        {/* Credential management section — only for admin+ editing lower-rank users */}
                        {show_credential_section && (
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
                                            value={new_email}
                                            onChange={e => setNewEmail(e.target.value)}
                                            className="flex-1"
                                        />
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handle_update_email}
                                            disabled={saving_email || !new_email}
                                            className="shrink-0"
                                        >
                                            {saving_email ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3 mr-1" />}
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
                                                type={show_password ? 'text' : 'password'}
                                                placeholder="Mínimo 8 caracteres"
                                                value={new_password}
                                                onChange={e => setNewPassword(e.target.value)}
                                            />
                                            <button
                                                type="button"
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                                onClick={() => setShowPassword(!show_password)}
                                            >
                                                {show_password ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handle_reset_password}
                                            disabled={saving_password || !new_password || new_password.length < 8}
                                            className="shrink-0"
                                        >
                                            {saving_password ? <Loader2 className="w-3 h-3 animate-spin" /> : <KeyRound className="w-3 h-3 mr-1" />}
                                            Cambiar
                                        </Button>
                                    </div>
                                    {new_password.length > 0 && new_password.length < 8 && (
                                        <p className="text-xs text-destructive mt-1">Mínimo 8 caracteres</p>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handle_save} disabled={saving || !form.first_name}>{saving ? 'Guardando...' : 'Guardar Perfil'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
