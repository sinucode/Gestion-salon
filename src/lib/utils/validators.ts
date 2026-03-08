import { z } from 'zod'

// ============================================
// Auth Schemas
// ============================================
export const LoginSchema = z.object({
    email: z.string().email('Correo electrónico inválido'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
})

export const CompleteProfileSchema = z.object({
    token: z.string().min(1),
    first_name: z.string().min(2, 'Mínimo 2 caracteres'),
    last_name: z.string().min(2, 'Mínimo 2 caracteres'),
    phone: z.string().min(7, 'Teléfono inválido'),
    document_id: z.string().optional(),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
})

// ============================================
// Business Schemas
// ============================================
export const BusinessSchema = z.object({
    name: z.string().min(2, 'Mínimo 2 caracteres'),
    slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones'),
    nit: z.string().optional(),
})

export const LocationSchema = z.object({
    business_id: z.string().uuid(),
    name: z.string().min(2, 'Mínimo 2 caracteres'),
    address: z.string().optional(),
    phone: z.string().optional(),
})

// ============================================
// Catalog Schemas
// ============================================
export const CategorySchema = z.object({
    business_id: z.string().uuid(),
    name: z.string().min(2, 'Mínimo 2 caracteres'),
    description: z.string().optional(),
    sort_order: z.number().int().min(0).default(0),
})

export const ServiceSchema = z.object({
    business_id: z.string().uuid(),
    category_id: z.string().uuid(),
    name: z.string().min(2, 'Mínimo 2 caracteres'),
    description: z.string().optional(),
    price: z.number().positive('El precio debe ser mayor a 0'),
    duration_min: z.number().int().min(5, 'Mínimo 5 minutos'),
    applies_to: z.string().default('all'),
})

export const ServiceAddonSchema = z.object({
    service_id: z.string().uuid(),
    business_id: z.string().uuid(),
    name: z.string().min(2, 'Mínimo 2 caracteres'),
    price: z.number().min(0),
    duration_min: z.number().int().min(0),
})

// ============================================
// Appointment Schemas
// ============================================
export const AppointmentSchema = z.object({
    business_id: z.string().uuid(),
    location_id: z.string().uuid(),
    professional_id: z.string().uuid(),
    client_id: z.string().uuid().optional(),
    is_walk_in: z.boolean().default(false),
    walk_in_name: z.string().optional(),
    starts_at: z.string().datetime(),
    service_ids: z.array(z.string().uuid()).min(1, 'Seleccione al menos un servicio'),
    addon_ids: z.array(z.string().uuid()).optional(),
    notes: z.string().optional(),
})

export const WalkInSchema = z.object({
    business_id: z.string().uuid(),
    location_id: z.string().uuid(),
    professional_id: z.string().uuid(),
    walk_in_name: z.string().min(2, 'Ingrese nombre y servicio (Ej: "Juan - Corte")'),
    service_ids: z.array(z.string().uuid()).min(1),
})

// ============================================
// Inventory Schemas
// ============================================
export const ProductSchema = z.object({
    business_id: z.string().uuid(),
    location_id: z.string().uuid(),
    name: z.string().min(2, 'Mínimo 2 caracteres'),
    sku: z.string().optional(),
    unit: z.enum(['ml', 'g', 'unidad', 'oz', 'litro']),
    cost_per_unit: z.number().positive('El costo debe ser mayor a 0'),
    stock_qty: z.number().min(0),
    min_stock: z.number().min(0),
})

export const ServiceRecipeSchema = z.object({
    service_id: z.string().uuid(),
    product_id: z.string().uuid(),
    qty_consumed: z.number().positive('La cantidad debe ser mayor a 0'),
})

// ============================================
// Damage Report Schemas
// ============================================
export const DamageReportSchema = z.object({
    business_id: z.string().uuid(),
    location_id: z.string().uuid(),
    product_id: z.string().uuid(),
    professional_id: z.string().uuid(),
    qty_damaged: z.number().positive('La cantidad debe ser mayor a 0'),
    reason: z.string().optional(),
})

export const DamageResolutionSchema = z.object({
    damage_report_id: z.string().uuid(),
    resolution: z.enum(['deduct_professional', 'absorb_location', 'paid_cash']),
})

// ============================================
// Feature Flag Schema
// ============================================
export const FeatureFlagSchema = z.object({
    business_id: z.string().uuid(),
    location_id: z.string().uuid().optional(),
    flag_key: z.string().min(1),
    is_enabled: z.boolean(),
})

// ============================================
// CSV Import Schema
// ============================================
export const CSVImportSchema = z.object({
    entity: z.enum(['products', 'services', 'clients', 'professionals', 'categories']),
})
