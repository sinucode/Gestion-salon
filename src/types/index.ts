import { UserRole } from '@/lib/constants'

// ============================================
// User / Profile
// ============================================
export interface Profile {
    id: string
    business_id: string | null
    location_id: string | null
    role: UserRole
    first_name: string
    last_name: string
    phone: string | null
    document_id: string | null
    avatar_url: string | null
    commission_pct: number
    is_active: boolean
    created_at: string
    updated_at: string
}

// ============================================
// Business & Location
// ============================================
export interface Business {
    id: string
    name: string
    slug: string
    nit: string | null
    logo_url: string | null
    primary_color: string | null
    secondary_color: string | null
    timezone: string
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface Location {
    id: string
    business_id: string
    name: string
    address: string | null
    phone: string | null
    is_active: boolean
    created_at: string
    updated_at: string
}

// ============================================
// Catalog
// ============================================
export interface Category {
    id: string
    business_id: string
    name: string
    description: string | null
    sort_order: number
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface Service {
    id: string
    business_id: string
    category_id: string
    name: string
    description: string | null
    price: number
    duration_min: number
    applies_to: string
    is_active: boolean
    created_at: string
    updated_at: string
    // Relations
    category?: Category
    addons?: ServiceAddon[]
    recipes?: ServiceRecipe[]
}

export interface ServiceAddon {
    id: string
    service_id: string
    business_id: string
    name: string
    price: number
    duration_min: number
    is_active: boolean
    created_at: string
}

// ============================================
// Appointments
// ============================================
export interface Appointment {
    id: string
    business_id: string
    location_id: string
    professional_id: string
    client_id: string | null
    walk_in_name: string | null
    is_walk_in: boolean
    status: string
    starts_at: string
    ends_at: string
    total_price: number
    notes: string | null
    approved_by: string | null
    approved_at: string | null
    created_at: string
    updated_at: string
    // Relations
    professional?: Profile
    client?: Profile
    services?: AppointmentService[]
    addons?: AppointmentAddon[]
}

export interface AppointmentService {
    id: string
    appointment_id: string
    service_id: string
    price: number
    duration_min: number
    service?: Service
}

export interface AppointmentAddon {
    id: string
    appointment_id: string
    addon_id: string
    price: number
    duration_min: number
    addon?: ServiceAddon
}

// ============================================
// Inventory
// ============================================
export interface Product {
    id: string
    business_id: string
    location_id: string
    name: string
    sku: string | null
    unit: string
    cost_per_unit: number
    stock_qty: number
    min_stock: number
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface ServiceRecipe {
    id: string
    service_id: string
    product_id: string
    qty_consumed: number
    product?: Product
}

export interface StockMovement {
    id: string
    product_id: string
    business_id: string
    location_id: string
    appointment_id: string | null
    type: string
    qty: number
    cost_total: number | null
    notes: string | null
    created_by: string
    created_at: string
}

// ============================================
// Damages
// ============================================
export interface DamageReport {
    id: string
    business_id: string
    location_id: string
    product_id: string
    professional_id: string
    qty_damaged: number
    cost_total: number
    reason: string | null
    resolution: string
    resolved_by: string | null
    resolved_at: string | null
    created_at: string
    updated_at: string
    // Relations
    product?: Product
    professional?: Profile
}

// ============================================
// Finance
// ============================================
export interface CashMovement {
    id: string
    business_id: string
    location_id: string
    appointment_id: string | null
    damage_report_id: string | null
    professional_id: string | null
    type: string
    amount: number
    description: string | null
    created_at: string
}

export interface PnLRow {
    business_id: string
    location_id: string
    date: string
    gross_income: number
    inventory_cost: number
    commissions: number
    damage_deductions: number
    net_profit: number
}

// ============================================
// Feature Flags
// ============================================
export interface FeatureFlag {
    id: string
    business_id: string
    location_id: string | null
    flag_key: string
    is_enabled: boolean
    updated_by: string | null
    updated_at: string
}

// ============================================
// Audit
// ============================================
export interface AuditLogEntry {
    id: string
    user_id: string
    business_id: string | null
    table_name: string
    record_id: string
    action: string
    old_values: Record<string, unknown> | null
    new_values: Record<string, unknown> | null
    ip_address: string | null
    created_at: string
}
