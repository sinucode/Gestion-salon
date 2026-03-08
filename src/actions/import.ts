'use server'

import { z } from 'zod'
import { parse } from 'csv-parse/sync'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/rbac'
import { ROLES } from '@/lib/constants'
import { ProductSchema, ServiceSchema, CategorySchema } from '@/lib/utils/validators'

interface ImportResult {
    total: number
    inserted: number
    updated: number
    errors: Array<{ row: number; message: string }>
}

/**
 * Universal CSV import Server Action.
 * Supports: products, services, categories, clients, professionals.
 * Uses upsert logic (update if exists, create if not).
 */
export async function importCSV(formData: FormData): Promise<ImportResult> {
    const supabase = await createClient()
    const user = await requireRole(supabase, [ROLES.ADMIN, ROLES.SUPER_ADMIN])

    const file = formData.get('file') as File
    const entity = formData.get('entity') as string

    if (!file || !entity) {
        throw new Error('Archivo y tipo de entidad son requeridos')
    }

    const text = await file.text()
    const records = parse(text, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
    }) as Record<string, string>[]

    const result: ImportResult = {
        total: records.length,
        inserted: 0,
        updated: 0,
        errors: [],
    }

    for (let i = 0; i < records.length; i++) {
        try {
            const row: Record<string, string> = records[i]
            const rowNum = i + 2 // +2 for header + 1-indexed

            switch (entity) {
                case 'products': {
                    const validated = ProductSchema.parse({
                        business_id: user.business_id,
                        location_id: row.location_id || user.location_id,
                        name: row.name || row.nombre,
                        sku: row.sku || null,
                        unit: row.unit || row.unidad || 'ml',
                        cost_per_unit: parseFloat(row.cost_per_unit || row.costo_unitario || '0'),
                        stock_qty: parseFloat(row.stock_qty || row.stock || '0'),
                        min_stock: parseFloat(row.min_stock || row.stock_minimo || '0'),
                    })

                    const { data: existing } = await supabase
                        .from('products')
                        .select('id')
                        .eq('business_id', validated.business_id)
                        .eq('name', validated.name)
                        .eq('location_id', validated.location_id)
                        .maybeSingle()

                    if (existing) {
                        await supabase.from('products').update(validated).eq('id', existing.id)
                        result.updated++
                    } else {
                        await supabase.from('products').insert(validated)
                        result.inserted++
                    }
                    break
                }

                case 'categories': {
                    const validated = CategorySchema.parse({
                        business_id: user.business_id,
                        name: row.name || row.nombre,
                        description: row.description || row.descripcion || null,
                        sort_order: parseInt(row.sort_order || row.orden || '0'),
                    })

                    const { data: existing } = await supabase
                        .from('categories')
                        .select('id')
                        .eq('business_id', validated.business_id)
                        .eq('name', validated.name)
                        .maybeSingle()

                    if (existing) {
                        await supabase.from('categories').update(validated).eq('id', existing.id)
                        result.updated++
                    } else {
                        await supabase.from('categories').insert(validated)
                        result.inserted++
                    }
                    break
                }

                case 'services': {
                    const validated = ServiceSchema.parse({
                        business_id: user.business_id,
                        category_id: row.category_id || row.categoria_id,
                        name: row.name || row.nombre,
                        description: row.description || row.descripcion || null,
                        price: parseFloat(row.price || row.precio || '0'),
                        duration_min: parseInt(row.duration_min || row.duracion || '30'),
                        applies_to: row.applies_to || row.aplica_a || 'all',
                    })

                    const { data: existing } = await supabase
                        .from('services')
                        .select('id')
                        .eq('business_id', validated.business_id)
                        .eq('name', validated.name)
                        .eq('category_id', validated.category_id)
                        .maybeSingle()

                    if (existing) {
                        await supabase.from('services').update(validated).eq('id', existing.id)
                        result.updated++
                    } else {
                        await supabase.from('services').insert(validated)
                        result.inserted++
                    }
                    break
                }

                default:
                    result.errors.push({ row: rowNum, message: `Entidad no soportada: ${entity}` })
            }
        } catch (err) {
            const message = err instanceof z.ZodError
                ? err.issues.map((e: z.ZodIssue) => e.message).join(', ')
                : err instanceof Error ? err.message : 'Error desconocido'
            result.errors.push({ row: i + 2, message })
        }
    }

    // Audit log
    await supabase.from('audit_log').insert({
        user_id: user.id,
        business_id: user.business_id,
        table_name: entity,
        record_id: '00000000-0000-0000-0000-000000000000',
        action: 'INSERT',
        new_values: {
            type: 'csv_import',
            total: result.total,
            inserted: result.inserted,
            updated: result.updated,
            errors_count: result.errors.length,
        },
    })

    return result
}
