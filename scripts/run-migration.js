import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabase_url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service_role_key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabase_url || !service_role_key) {
    console.error("❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
    process.exit(1);
}

async function run() {
    const migration_file = process.argv[2] || '016_strict_profile_rls.sql';
    const migration_path = path.join(__dirname, '../supabase/migrations/', migration_file);

    if (!fs.existsSync(migration_path)) {
        console.error(`❌ No se encontró: ${migration_path}`);
        process.exit(1);
    }

    const migration_sql = fs.readFileSync(migration_path, 'utf8');

    // Use the Supabase SQL API (undocumented internal endpoint for pg-meta)
    const project_ref = supabase_url.replace('https://', '').replace('.supabase.co', '');

    console.log(`Ejecutando migración ${migration_file} en proyecto ${project_ref}...`);

    // Try Supabase pg-meta query endpoint
    const response = await fetch(`${supabase_url}/pg/query`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': service_role_key,
            'Authorization': `Bearer ${service_role_key}`,
            'x-connection-encrypted': 'false',
        },
        body: JSON.stringify({ query: migration_sql }),
    });

    if (response.ok) {
        const result = await response.json();
        console.log("✅ ¡Migración ejecutada exitosamente!");
        console.log("Resultado:", JSON.stringify(result).substring(0, 200));
        return;
    }

    // If pg/query failed, try connecting via postgres package
    console.log(`⚠ pg/query no disponible (${response.status}). Intentando via postgres directo...`);

    try {
        const postgres = (await import('postgres')).default;
        const db_url = process.env.DATABASE_URL;
        if (!db_url) {
            console.error("❌ DATABASE_URL no está definido en .env.local");
            console.error("Añade: DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres");
            console.error("Encuéntrala en: Supabase Dashboard > Project Settings > Database > Connection string");
            process.exit(1);
        }
        const sql = postgres(db_url, { ssl: 'require' });
        await sql.unsafe(migration_sql);
        console.log("✅ ¡Migración ejecutada exitosamente!");
        await sql.end();
    } catch (err) {
        console.error("❌ Error:", err.message);
        process.exit(1);
    }
}

run();
