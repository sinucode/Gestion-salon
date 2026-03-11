'use client'

import { useEffect, useState } from 'react'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore, useFeatureFlagsStore } from '@/stores'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Building2, MapPin } from 'lucide-react'
import { UserRole } from '@/lib/constants'

interface FilterOption {
    id: string
    name: string
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { setUser, setBusiness, setLocation, setLoading, isLoading, user, selectedBusinessId, setSelectedBusinessId, selectedLocationId, setSelectedLocationId } = useAuthStore()
    const { setFlags } = useFeatureFlagsStore()
    const [ready, setReady] = useState(false)
    const [businessOptions, setBusinessOptions] = useState<FilterOption[]>([])
    const [locationOptions, setLocationOptions] = useState<FilterOption[]>([])

    // Initial auth load
    useEffect(() => {
        const loadUserData = async () => {
            setLoading(true)
            const supabase = createClient()

            const { data: { user: authUser } } = await supabase.auth.getUser()
            if (!authUser) {
                setLoading(false)
                setReady(true)
                return
            }

            // Fetch profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', authUser.id)
                .single()

            if (profile) {
                setUser({
                    ...profile,
                    email: authUser.email ?? '',
                    role: profile.role as UserRole,
                })

                // Fetch business
                if (profile.business_id) {
                    const { data: business } = await supabase
                        .from('businesses')
                        .select('*')
                        .eq('id', profile.business_id)
                        .single()
                    if (business) setBusiness(business)
                }

                // Fetch location
                if (profile.location_id) {
                    const { data: location } = await supabase
                        .from('locations')
                        .select('*')
                        .eq('id', profile.location_id)
                        .single()
                    if (location) setLocation(location)
                }

                // Fetch feature flags
                if (profile.business_id) {
                    const { data: flags } = await supabase
                        .from('feature_flags')
                        .select('*')
                        .eq('business_id', profile.business_id)
                    if (flags) setFlags(flags)
                }

                // Sync initial filters based on roles
                if (profile.role === 'admin' && profile.business_id) {
                    setSelectedBusinessId(profile.business_id)
                } else if ((profile.role === 'professional' || profile.role === 'client') && profile.business_id) {
                    setSelectedBusinessId(profile.business_id)
                    if (profile.location_id) setSelectedLocationId(profile.location_id)
                }

                // Load initial businesses for super admin
                if (profile.role === 'super_admin') {
                    const { data: bizs } = await supabase
                        .from('businesses')
                        .select('id, name')
                        .eq('is_active', true)
                        .order('name')
                    if (bizs) setBusinessOptions(bizs)
                }
            }

            setLoading(false)
            setReady(true)
        }

        loadUserData()
    }, [setUser, setBusiness, setLocation, setLoading, setFlags, setSelectedBusinessId, setSelectedLocationId])

    // When super admin changes business, reload feature flags
    useEffect(() => {
        if (!selectedBusinessId || selectedBusinessId === 'all' || !user || user.role !== 'super_admin') return
        const loadFlags = async () => {
            const supabase = createClient()
            const { data: flags } = await supabase
                .from('feature_flags')
                .select('*')
                .eq('business_id', selectedBusinessId)
            if (flags) setFlags(flags)
        }
        loadFlags()
    }, [selectedBusinessId, user, setFlags])

    // Load locations based on selected business (or admin's own business via RLS)
    useEffect(() => {
        if (!user || (user.role !== 'super_admin' && user.role !== 'admin')) return

        const fetchLocations = async () => {
            const supabase = createClient()
            let query = supabase.from('locations').select('id, name').eq('is_active', true)
            
            // Only refine if not 'all' for super_admin. Admins are automatically scoped via RLS.
            if (user.role === 'super_admin' && selectedBusinessId !== 'all') {
                query = query.eq('business_id', selectedBusinessId)
            } else if (user.role === 'super_admin' && selectedBusinessId === 'all') {
                // Return no locations if no business is selected by super admin
                setLocationOptions([])
                return
            }

            const { data } = await query.order('name')
            if (data) setLocationOptions(data)
        }
        fetchLocations()
    }, [user, selectedBusinessId])

    const isSuperAdmin = user?.role === 'super_admin'
    const isAdmin = user?.role === 'admin'
    const canSeeFilters = isSuperAdmin || isAdmin

    if (!ready || isLoading) {
        return (
            <div className="flex h-screen">
                <div className="w-64 bg-sidebar border-r border-sidebar-border p-4 space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-6 w-1/2" />
                    <Skeleton className="h-6 w-2/3" />
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-6 w-1/2" />
                </div>
                <div className="flex-1 p-8 space-y-4">
                    <Skeleton className="h-8 w-48" />
                    <div className="grid grid-cols-3 gap-4">
                        <Skeleton className="h-32" />
                        <Skeleton className="h-32" />
                        <Skeleton className="h-32" />
                    </div>
                    <Skeleton className="h-64" />
                </div>
            </div>
        )
    }

    return (
        <SidebarProvider>
            <AppSidebar />
            <SidebarInset>
                <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/50 px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-30">
                    <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
                    <Separator orientation="vertical" className="mr-2 !h-4" />
                    <div className="flex-1">
                        {user && (
                            <p className="text-sm text-muted-foreground">
                                {user.role === 'super_admin' && '🛡️ Super Admin'}
                                {user.role === 'admin' && '👔 Administrador'}
                                {user.role === 'professional' && '✂️ Profesional'}
                                {user.role === 'client' && '👤 Cliente'}
                            </p>
                        )}
                    </div>

                    {/* Global Business Selector — Super Admin only */}
                    {isSuperAdmin && businessOptions.length > 0 && (
                        <Select
                            value={selectedBusinessId}
                            onValueChange={(v) => setSelectedBusinessId(v || 'all')}
                        >
                            <SelectTrigger className="w-[200px] border-border/50 bg-card/80 backdrop-blur-sm">
                                <Building2 className="w-4 h-4 mr-2 text-violet-500" />
                                <SelectValue placeholder="Seleccionar negocio" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">🌐 Todos los negocios</SelectItem>
                                {businessOptions.map((biz) => (
                                    <SelectItem key={biz.id} value={biz.id}>
                                        {biz.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    {/* Global Location Selector — Super Admin and Admin only */}
                    {canSeeFilters && (
                        <Select
                            value={selectedLocationId}
                            onValueChange={(v) => setSelectedLocationId(v || 'all')}
                            disabled={isSuperAdmin && selectedBusinessId === 'all'}
                        >
                            <SelectTrigger className="w-[200px] border-border/50 bg-card/80 backdrop-blur-sm">
                                <MapPin className="w-4 h-4 mr-2 text-emerald-500" />
                                <SelectValue placeholder={isSuperAdmin && selectedBusinessId === 'all' ? 'Selecciona negocio' : 'Selecciona sede'} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">📍 Todas las Sedes</SelectItem>
                                {locationOptions.map((loc) => (
                                    <SelectItem key={loc.id} value={loc.id}>
                                        {loc.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </header>
                <main className="flex-1 p-4 md:p-6 lg:p-8">
                    {children}
                </main>
            </SidebarInset>
        </SidebarProvider>
    )
}

