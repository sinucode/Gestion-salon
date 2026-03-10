import { getHolidaysForYear } from 'colombian-holidays'

export interface Holiday {
    date: string // ISO date string (YYYY-MM-DD)
    name: string
}

/**
 * Returns a list of Colombian holidays for a specific year.
 */
export function getColombianHolidays(year: number): Holiday[] {
    const holidays = getHolidaysForYear(year)
    return holidays.map((h: any) => ({
        date: h.celebrationDate, // The actual date the holiday is celebrated
        name: h.name.es,
    }))
}

/**
 * Checks if a specific date is a Colombian holiday.
 */
export function isHoliday(date: Date, holidays: Holiday[]): Holiday | undefined {
    const dateStr = date.toISOString().split('T')[0]
    return holidays.find(h => h.date === dateStr)
}
