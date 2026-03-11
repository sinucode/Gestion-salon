/**
 * Format a number as Colombian Pesos (COP).
 */
export function format_currency(amount: number | null | undefined): string {
    if (amount === null || amount === undefined) {
        return '$ 0'
    }
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount).replace(/\s/g, ' ') // Optional spacing normalization, though es-CO handles this
}

/**
 * Parse a COP string back to a number.
 */
export function parse_currency(value: string): number {
    return Number(value.replace(/[^0-9-]/g, ''))
}
