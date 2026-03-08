/**
 * Format a number as Colombian Pesos (COP).
 */
export function formatCOP(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount)
}

/**
 * Parse a COP string back to a number.
 */
export function parseCOP(value: string): number {
    return Number(value.replace(/[^0-9-]/g, ''))
}
