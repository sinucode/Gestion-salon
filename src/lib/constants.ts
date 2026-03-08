// ============================================
// ROLES
// ============================================
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  PROFESSIONAL: 'professional',
  CLIENT: 'client',
} as const

export type UserRole = (typeof ROLES)[keyof typeof ROLES]

// ============================================
// ROLE HIERARCHY (higher number = more power)
// ============================================
export const ROLE_RANK: Record<UserRole, number> = {
  [ROLES.SUPER_ADMIN]: 4,
  [ROLES.ADMIN]: 3,
  [ROLES.PROFESSIONAL]: 2,
  [ROLES.CLIENT]: 1,
}

// ============================================
// APPOINTMENT STATUSES
// ============================================
export const APPOINTMENT_STATUS = {
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  APPROVED: 'approved',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
} as const

export type AppointmentStatus = (typeof APPOINTMENT_STATUS)[keyof typeof APPOINTMENT_STATUS]

// ============================================
// DAMAGE RESOLUTIONS
// ============================================
export const DAMAGE_RESOLUTION = {
  PENDING: 'pending',
  DEDUCT_PROFESSIONAL: 'deduct_professional',
  ABSORB_LOCATION: 'absorb_location',
  PAID_CASH: 'paid_cash',
} as const

export type DamageResolution = (typeof DAMAGE_RESOLUTION)[keyof typeof DAMAGE_RESOLUTION]

// ============================================
// MOVEMENT TYPES
// ============================================
export const MOVEMENT_TYPE = {
  INCOME: 'income',
  EXPENSE: 'expense',
  COMMISSION: 'commission',
  DAMAGE_DEDUCTION: 'damage_deduction',
  DAMAGE_ABSORB: 'damage_absorb',
} as const

export type MovementType = (typeof MOVEMENT_TYPE)[keyof typeof MOVEMENT_TYPE]

// ============================================
// FEATURE FLAG KEYS
// ============================================
export const FEATURE_FLAGS = {
  MODULE_COMMISSIONS: 'module_commissions',
  MODULE_INVENTORY_DEDUCTION: 'module_inventory_deduction',
  MODULE_DAMAGE_DEDUCTION: 'module_damage_deduction',
  MODULE_WALK_INS: 'module_walk_ins',
  MODULE_CSV_IMPORT: 'module_csv_import',
} as const

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS]

// ============================================
// TIMEZONE
// ============================================
export const DEFAULT_TIMEZONE = 'America/Bogota'

/** Common IANA timezones for the business settings dropdown */
export const TIMEZONE_OPTIONS = [
  { value: 'America/Bogota', label: '🇨🇴 Colombia (Bogotá)' },
  { value: 'America/Mexico_City', label: '🇲🇽 México (Ciudad de México)' },
  { value: 'America/Lima', label: '🇵🇪 Perú (Lima)' },
  { value: 'America/Santiago', label: '🇨🇱 Chile (Santiago)' },
  { value: 'America/Argentina/Buenos_Aires', label: '🇦🇷 Argentina (Buenos Aires)' },
  { value: 'America/Caracas', label: '🇻🇪 Venezuela (Caracas)' },
  { value: 'America/Guayaquil', label: '🇪🇨 Ecuador (Guayaquil)' },
  { value: 'America/Panama', label: '🇵🇦 Panamá' },
  { value: 'America/Costa_Rica', label: '🇨🇷 Costa Rica' },
  { value: 'America/New_York', label: '🇺🇸 EE.UU. (Nueva York)' },
  { value: 'America/Los_Angeles', label: '🇺🇸 EE.UU. (Los Ángeles)' },
  { value: 'America/Chicago', label: '🇺🇸 EE.UU. (Chicago)' },
  { value: 'America/Sao_Paulo', label: '🇧🇷 Brasil (São Paulo)' },
  { value: 'Europe/Madrid', label: '🇪🇸 España (Madrid)' },
  { value: 'Europe/London', label: '🇬🇧 Reino Unido (Londres)' },
] as const
