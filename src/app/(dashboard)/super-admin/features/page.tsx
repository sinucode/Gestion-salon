'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ToggleLeft, Loader2, Building2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const MODULE_FLAGS = [
    { key: 'mod_catalog', label: 'Catálogo', description: 'Categorías y servicios del negocio' },
    { key: 'mod_appointments', label: 'Citas', description: 'Agenda, citas express y aprobaciones' },
    { key: 'mod_inventory', label: 'Inventario', description: 'Productos, stock y recetas de consumo' },
    { key: 'mod_damages', label: 'Novedades', description: 'Reportes de daños y resoluciones' },
    { key: 'mod_finance', label: 'Finanzas', description: 'Movimientos de caja y comisiones' },
    { key: 'mod_import', label: 'Importar CSV', description: 'Importación masiva de datos' },
]

interface BusinessFlags {
    id: string
    name: string
    slug: string
    flags: Record<string, { id: string; is_enabled: boolean }>
}

export default function FeatureFlagsPage() {
    const [businesses, setBusinesses] = useState<BusinessFlags[]>([])
    const [loading, setLoading] = useState(true)
    const [toggling, setToggling] = useState<string | null>(null)

    const fetchData = async () => {
        const supabase = createClient()

        const { data: bizs } = await supabase
            .from('businesses')
            .select('id, name, slug')
            .order('name')

        const { data: flags } = await supabase
            .from('feature_flags')
            .select('*')

        if (bizs) {
            const mapped = bizs.map(biz => {
                const bizFlags: Record<string, { id: string; is_enabled: boolean }> = {}
                MODULE_FLAGS.forEach(mf => {
                    const found = flags?.find(f => f.business_id === biz.id && f.flag_key === mf.key)
                    if (found) {
                        bizFlags[mf.key] = { id: found.id, is_enabled: found.is_enabled }
                    }
                })
                return { id: biz.id, name: biz.name, slug: biz.slug, flags: bizFlags }
            })
            setBusinesses(mapped)
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchData()
    }, [])

    const handleToggle = async (businessId: string, flagKey: string, currentState: boolean) => {
        const toggleId = `${businessId}-${flagKey}`
        setToggling(toggleId)
        const supabase = createClient()

        const biz = businesses.find(b => b.id === businessId)
        const existing = biz?.flags[flagKey]

        if (existing) {
            // Update
            const { error } = await supabase
                .from('feature_flags')
                .update({ is_enabled: !currentState })
                .eq('id', existing.id)

            if (error) {
                toast.error('Error al actualizar: ' + error.message)
            } else {
                toast.success(`${flagKey} → ${!currentState ? 'Activado' : 'Desactivado'}`)
                // Optimistic update
                setBusinesses(prev => prev.map(b => {
                    if (b.id !== businessId) return b
                    return {
                        ...b,
                        flags: { ...b.flags, [flagKey]: { ...existing, is_enabled: !currentState } }
                    }
                }))
            }
        } else {
            // Insert
            const { data, error } = await supabase
                .from('feature_flags')
                .insert({ business_id: businessId, flag_key: flagKey, is_enabled: true })
                .select()
                .single()

            if (error) {
                toast.error('Error al crear: ' + error.message)
            } else {
                toast.success(`${flagKey} → Activado`)
                setBusinesses(prev => prev.map(b => {
                    if (b.id !== businessId) return b
                    return {
                        ...b,
                        flags: { ...b.flags, [flagKey]: { id: data.id, is_enabled: true } }
                    }
                }))
            }
        }
        setToggling(null)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Feature Flags</h1>
                <p className="text-muted-foreground">Activa o desactiva módulos por negocio</p>
            </div>

            {businesses.length === 0 ? (
                <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                    <CardContent className="py-12 text-center">
                        <ToggleLeft className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                        <p className="text-muted-foreground">No hay negocios registrados.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-6">
                    {businesses.map((biz) => (
                        <Card key={biz.id} className="border-border/50 bg-card/80 backdrop-blur-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <Building2 className="w-5 h-5 text-violet-500" />
                                    {biz.name}
                                </CardTitle>
                                <CardDescription className="font-mono text-xs">{biz.slug}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-3">
                                    {MODULE_FLAGS.map((mf) => {
                                        const flagState = biz.flags[mf.key]
                                        const enabled = flagState?.is_enabled ?? false
                                        const isToggling = toggling === `${biz.id}-${mf.key}`

                                        return (
                                            <div
                                                key={mf.key}
                                                className="flex items-center justify-between p-3 rounded-lg border border-border/30 bg-muted/20 hover:bg-muted/40 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div>
                                                        <p className="text-sm font-medium">{mf.label}</p>
                                                        <p className="text-xs text-muted-foreground">{mf.description}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <Badge
                                                        variant={enabled ? 'default' : 'secondary'}
                                                        className={`text-xs ${enabled ? 'bg-green-500/10 text-green-500' : ''}`}
                                                    >
                                                        {enabled ? 'ON' : 'OFF'}
                                                    </Badge>
                                                    <Switch
                                                        checked={enabled}
                                                        disabled={isToggling}
                                                        onCheckedChange={() => handleToggle(biz.id, mf.key, enabled)}
                                                    />
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
