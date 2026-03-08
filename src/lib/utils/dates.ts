import { DEFAULT_TIMEZONE } from '@/lib/constants'

/**
 * Get the current date/time in the given timezone.
 */
export function nowInTimezone(timezone?: string): Date {
    const tz = timezone || DEFAULT_TIMEZONE
    return new Date(
        new Date().toLocaleString('en-US', { timeZone: tz })
    )
}

/**
 * Format a date to a localized string in the given timezone.
 */
export function formatDate(date: Date | string, timezone?: string, options?: Intl.DateTimeFormatOptions): string {
    const tz = timezone || DEFAULT_TIMEZONE
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('es-CO', {
        timeZone: tz,
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        ...options,
    })
}

/**
 * Format a time to a localized string in the given timezone.
 */
export function formatTime(date: Date | string, timezone?: string): string {
    const tz = timezone || DEFAULT_TIMEZONE
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleTimeString('es-CO', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    })
}

/**
 * Format a datetime to a localized string in the given timezone.
 */
export function formatDateTime(date: Date | string, timezone?: string): string {
    const tz = timezone || DEFAULT_TIMEZONE
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleString('es-CO', {
        timeZone: tz,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    })
}

/**
 * Get the start of today in the given timezone as an ISO string.
 */
export function startOfToday(timezone?: string): string {
    const now = nowInTimezone(timezone)
    now.setHours(0, 0, 0, 0)
    return now.toISOString()
}

/**
 * Get the end of today in the given timezone as an ISO string.
 */
export function endOfToday(timezone?: string): string {
    const now = nowInTimezone(timezone)
    now.setHours(23, 59, 59, 999)
    return now.toISOString()
}

/**
 * Check if a given date is a weekend day.
 */
export function isWeekend(date: Date): boolean {
    const day = date.getDay()
    return day === 0 || day === 6
}
