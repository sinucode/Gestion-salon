import { APP_TIMEZONE } from '@/lib/constants'

/**
 * Get the current date/time in America/Bogota timezone.
 */
export function nowBogota(): Date {
    return new Date(
        new Date().toLocaleString('en-US', { timeZone: APP_TIMEZONE })
    )
}

/**
 * Format a date to a localized Colombian string.
 */
export function formatDateCO(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('es-CO', {
        timeZone: APP_TIMEZONE,
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        ...options,
    })
}

/**
 * Format a time to a localized Colombian string.
 */
export function formatTimeCO(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleTimeString('es-CO', {
        timeZone: APP_TIMEZONE,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    })
}

/**
 * Format a datetime to a localized Colombian string.
 */
export function formatDateTimeCO(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleString('es-CO', {
        timeZone: APP_TIMEZONE,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    })
}

/**
 * Get the start of today in Bogota timezone as an ISO string.
 */
export function startOfTodayBogota(): string {
    const now = nowBogota()
    now.setHours(0, 0, 0, 0)
    return now.toISOString()
}

/**
 * Get the end of today in Bogota timezone as an ISO string.
 */
export function endOfTodayBogota(): string {
    const now = nowBogota()
    now.setHours(23, 59, 59, 999)
    return now.toISOString()
}

/**
 * Check if a given date is a Colombian holiday.
 * This is a placeholder — holidays should be checked against the holidays_co table.
 */
export function isWeekend(date: Date): boolean {
    const day = date.getDay()
    return day === 0 || day === 6
}
