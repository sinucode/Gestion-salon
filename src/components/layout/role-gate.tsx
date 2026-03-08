'use client'

import { useAuthStore } from '@/stores'
import { hasPermission } from '@/lib/auth/rbac'
import { UserRole } from '@/lib/constants'
import { ShieldAlert } from 'lucide-react'

interface RoleGateProps {
    children: React.ReactNode
    permission?: string
    allowedRoles?: UserRole[]
    fallback?: React.ReactNode
}

/**
 * Client component that conditionally renders children based on user role/permission.
 */
export function RoleGate({ children, permission, allowedRoles, fallback }: RoleGateProps) {
    const { user } = useAuthStore()

    if (!user) return null

    // Check by permission string
    if (permission && !hasPermission(user.role, permission)) {
        return fallback ?? <AccessDenied />
    }

    // Check by explicit role list
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return fallback ?? <AccessDenied />
    }

    return <>{children}</>
}

function AccessDenied() {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <ShieldAlert className="w-12 h-12 mb-4 text-destructive/50" />
            <h2 className="text-lg font-semibold">Acceso Restringido</h2>
            <p className="text-sm mt-1">No tienes permisos para ver este contenido.</p>
        </div>
    )
}
