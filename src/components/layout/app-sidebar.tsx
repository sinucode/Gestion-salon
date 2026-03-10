'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarRail,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    LayoutDashboard,
    Building2,
    MapPin,
    Users,
    Layers,
    CalendarDays,
    Package,
    AlertTriangle,
    DollarSign,
    Upload,
    ToggleLeft,
    FileText,
    LogOut,
    Settings,
    Scissors,
    ChevronUp,
} from 'lucide-react'
import { useAuthStore, useFeatureFlagsStore } from '@/stores'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { hasPermission } from '@/lib/auth/rbac'

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    LayoutDashboard,
    Building2,
    MapPin,
    Users,
    Layers,
    CalendarDays,
    Package,
    AlertTriangle,
    DollarSign,
    Upload,
    ToggleLeft,
    FileText,
}

const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard', permission: null, featureFlag: null },
    { label: 'Negocios', href: '/super-admin/businesses', icon: 'Building2', permission: 'businesses.read', featureFlag: null },
    { label: 'Sedes', href: '/admin/locations', icon: 'MapPin', permission: 'locations.read', featureFlag: null },
    { label: 'Usuarios', href: '/admin/users', icon: 'Users', permission: 'users.read', featureFlag: null },
    { label: 'Catálogo', href: '/catalog', icon: 'Layers', permission: 'catalog.read', featureFlag: 'mod_catalog' },
    { label: 'Citas', href: '/appointments', icon: 'CalendarDays', permission: 'appointments.read', featureFlag: 'mod_appointments' },
    { label: 'Inventario', href: '/inventory', icon: 'Package', permission: 'inventory.read', featureFlag: 'mod_inventory' },
    { label: 'Novedades', href: '/damages', icon: 'AlertTriangle', permission: 'damages.read', featureFlag: 'mod_damages' },
    { label: 'Finanzas', href: '/finance', icon: 'DollarSign', permission: 'finance.read', featureFlag: 'mod_finance' },
    { label: 'Importar CSV', href: '/import', icon: 'Upload', permission: 'import.write', featureFlag: 'mod_import' },
    { label: 'Feature Flags', href: '/super-admin/features', icon: 'ToggleLeft', permission: 'feature_flags.write', featureFlag: null },
    { label: 'Auditoría', href: '/super-admin/audit', icon: 'FileText', permission: 'audit.read', featureFlag: null },
]

export function AppSidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const { user } = useAuthStore()
    const { isEnabled } = useFeatureFlagsStore()

    const isSuperAdmin = user?.role === 'super_admin'

    const filteredItems = navItems.filter((item) => {
        // Check permission
        if (item.permission !== null && !(user && hasPermission(user.role, item.permission))) return false
        // Check feature flag (super_admin always sees everything)
        if (item.featureFlag && !isSuperAdmin && !isEnabled(item.featureFlag)) return false
        return true
    })

    const handleLogout = async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    const initials = user
        ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase()
        : '??'

    return (
        <Sidebar collapsible="icon" className="border-r border-sidebar-border">
            <SidebarHeader className="p-4">
                <Link href="/dashboard" className="flex items-center gap-3 group">
                    <div className="w-9 h-9 rounded-lg gradient-brand-dark flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
                        <Scissors className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                        <span className="text-sm font-bold text-sidebar-foreground tracking-tight">
                            Gestión Salón
                        </span>
                        <span className="text-[10px] text-sidebar-foreground/50 uppercase tracking-wider">
                            Sistema Integral
                        </span>
                    </div>
                </Link>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-widest">
                        Navegación
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {filteredItems.map((item) => {
                                const Icon = iconMap[item.icon] || LayoutDashboard
                                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                                return (
                                    <SidebarMenuItem key={item.href}>
                                        <SidebarMenuButton
                                            isActive={isActive}
                                            tooltip={item.label}
                                            className="transition-all duration-200"
                                            render={<Link href={item.href} />}
                                        >
                                            <Icon className="w-4 h-4" />
                                            <span>{item.label}</span>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                )
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="p-2">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <DropdownMenu>
                            <DropdownMenuTrigger>
                                <SidebarMenuButton
                                    size="lg"
                                    className="w-full hover:bg-sidebar-accent"
                                >
                                    <Avatar className="w-8 h-8 rounded-lg">
                                        <AvatarFallback className="rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-xs font-bold">
                                            {initials}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                                        <span className="truncate font-medium text-sidebar-foreground">
                                            {user?.first_name} {user?.last_name}
                                        </span>
                                        <span className="truncate text-xs text-sidebar-foreground/50">
                                            {user?.role?.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <ChevronUp className="ml-auto w-4 h-4 text-sidebar-foreground/40 group-data-[collapsible=icon]:hidden" />
                                </SidebarMenuButton>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="top" align="end" className="w-56">
                                <DropdownMenuItem onClick={() => router.push('/settings')}>
                                    <Settings className="w-4 h-4" />
                                    Configuración
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={handleLogout}
                                    className="text-destructive focus:text-destructive"
                                >
                                    <LogOut className="w-4 h-4 mr-2" />
                                    Cerrar Sesión
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>

            <SidebarRail />
        </Sidebar>
    )
}
