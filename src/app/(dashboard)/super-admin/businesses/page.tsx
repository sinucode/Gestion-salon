'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Plus, MapPin, Users, Loader2, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import type { Business } from '@/types'

interface BusinessWithCounts extends Business {
    locations: { count: number }[]
    profiles: { count: number }[]
}

export default function BusinessesPage() {
    const [businesses, setBusinesses] = useState<BusinessWithCounts[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchBusinesses = async () => {
            const supabase = createClient()
            const { data, error } = await supabase
                .from('businesses')
                .select('*, locations(count), profiles(count)')
                .order('created_at', { ascending: false })

            if (data) setBusinesses(data as unknown as BusinessWithCounts[])
            setLoading(false)
        }
        fetchBusinesses()
    }, [])

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Negocios</h1>
                    <p className="text-muted-foreground">Administra los negocios registrados en la plataforma</p>
                </div>
                <Button className="gradient-brand text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Nuevo Negocio
                </Button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
            ) : businesses.length === 0 ? (
                <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                    <CardContent className="py-12 text-center">
                        <Building2 className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                        <p className="text-muted-foreground">No hay negocios registrados aún.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {businesses.map((biz) => (
                        <Card key={biz.id} className="group hover:shadow-lg transition-all duration-300 border-border/50 bg-card/80 backdrop-blur-sm">
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle className="text-lg">{biz.name}</CardTitle>
                                        <p className="text-xs text-muted-foreground mt-1 font-mono">{biz.slug}</p>
                                    </div>
                                    <Badge variant={biz.is_active ? 'default' : 'secondary'} className="text-xs">
                                        {biz.is_active ? 'Activo' : 'Inactivo'}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        <MapPin className="w-3.5 h-3.5" />
                                        {biz.locations?.[0]?.count ?? 0} sedes
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Users className="w-3.5 h-3.5" />
                                        {biz.profiles?.[0]?.count ?? 0} usuarios
                                    </span>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Globe className="w-3 h-3" />
                                    {biz.timezone}
                                </div>
                                {biz.nit && (
                                    <p className="text-xs text-muted-foreground">NIT: {biz.nit}</p>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
