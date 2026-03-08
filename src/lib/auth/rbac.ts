import { SupabaseClient } from '@supabase/supabase-js'
import { UserRole, ROLES } from '@/lib/constants'

// ============================================
// Permission Matrix
// ============================================
const PERMISSIONS: Record<string, UserRole[]> = {
    // Business Management
    'businesses.read': [ROLES.SUPER_ADMIN],
    'businesses.write': [ROLES.SUPER_ADMIN],

    // Location Management
    'locations.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
    'locations.write': [ROLES.SUPER_ADMIN, ROLES.ADMIN],

    // User Management
    'users.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
    'users.write': [ROLES.SUPER_ADMIN, ROLES.ADMIN],

    // Service Catalog
    'catalog.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PROFESSIONAL],
    'catalog.write': [ROLES.SUPER_ADMIN, ROLES.ADMIN],

    // Appointments
    'appointments.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PROFESSIONAL, ROLES.CLIENT],
    'appointments.write': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PROFESSIONAL],
    'appointments.approve': [ROLES.SUPER_ADMIN, ROLES.ADMIN],

    // Walk-ins
    'walkins.write': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PROFESSIONAL],

    // Inventory
    'inventory.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PROFESSIONAL],
    'inventory.write': [ROLES.SUPER_ADMIN, ROLES.ADMIN],

    // Damage Reports
    'damages.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PROFESSIONAL],
    'damages.write': [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PROFESSIONAL],
    'damages.resolve': [ROLES.SUPER_ADMIN, ROLES.ADMIN],

    // Finance / P&L
    'finance.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
    'finance.read_own': [ROLES.PROFESSIONAL],

    // Feature Flags
    'feature_flags.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
    'feature_flags.write': [ROLES.SUPER_ADMIN],

    // Audit Log
    'audit.read': [ROLES.SUPER_ADMIN, ROLES.ADMIN],

    // CSV Import
    'import.write': [ROLES.SUPER_ADMIN, ROLES.ADMIN],
}

// ============================================
// Types
// ============================================
export interface UserProfile {
    id: string
    role: UserRole
    business_id: string | null
    location_id: string | null
    first_name: string
    last_name: string
    email: string
}

// ============================================
// Auth Helpers
// ============================================

/**
 * Get the current authenticated user with profile data.
 */
export async function getCurrentUser(supabase: SupabaseClient): Promise<UserProfile | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
        .from('profiles')
        .select('id, role, business_id, location_id, first_name, last_name')
        .eq('id', user.id)
        .single()

    if (!profile) return null

    return {
        ...profile,
        email: user.email ?? '',
    }
}

/**
 * Require that the user is authenticated and has one of the allowed roles.
 * Throws an error if not authorized.
 */
export async function requireRole(
    supabase: SupabaseClient,
    allowedRoles: UserRole[]
): Promise<UserProfile> {
    const user = await getCurrentUser(supabase)

    if (!user) {
        throw new Error('No autenticado')
    }

    if (!allowedRoles.includes(user.role)) {
        throw new Error('No autorizado. Rol requerido: ' + allowedRoles.join(', '))
    }

    return user
}

/**
 * Check if a user role has a specific permission.
 */
export function hasPermission(role: UserRole, permission: string): boolean {
    const allowed = PERMISSIONS[permission]
    if (!allowed) return false
    return allowed.includes(role)
}

/**
 * Get sidebar navigation items filtered by role.
 */
export function getNavItemsForRole(role: UserRole) {
    const allItems = [
        { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard', permission: null },
        { label: 'Negocios', href: '/super-admin/businesses', icon: 'Building2', permission: 'businesses.read' },
        { label: 'Sedes', href: '/admin/locations', icon: 'MapPin', permission: 'locations.read' },
        { label: 'Usuarios', href: '/admin/users', icon: 'Users', permission: 'users.read' },
        { label: 'Catálogo', href: '/catalog', icon: 'Layers', permission: 'catalog.read' },
        { label: 'Citas', href: '/appointments', icon: 'CalendarDays', permission: 'appointments.read' },
        { label: 'Inventario', href: '/inventory', icon: 'Package', permission: 'inventory.read' },
        { label: 'Novedades', href: '/damages', icon: 'AlertTriangle', permission: 'damages.read' },
        { label: 'Finanzas', href: '/finance', icon: 'DollarSign', permission: 'finance.read' },
        { label: 'Importar', href: '/import', icon: 'Upload', permission: 'import.write' },
        { label: 'Feature Flags', href: '/super-admin/features', icon: 'ToggleLeft', permission: 'feature_flags.write' },
        { label: 'Auditoría', href: '/super-admin/audit', icon: 'FileText', permission: 'audit.read' },
    ]

    return allItems.filter(
        (item) => item.permission === null || hasPermission(role, item.permission)
    )
}
