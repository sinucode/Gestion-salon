import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function run() {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error("❌ Error: DATABASE_URL no está definido.");
        console.error("Por favor, añade DATABASE_URL=postgresql://postgres.xxx:password@aws-xxx.pooler.supabase.com:6543/postgres en tu archivo .env.local.");
        process.exit(1);
    }

    console.log("Conectando a la base de datos...");
    const sql = postgres(dbUrl, {
        ssl: 'require',
    });

    try {
        const migrationPath = path.join(__dirname, '../supabase/migrations/014_audit_triggers.sql');
        const migrationSql = fs.readFileSync(migrationPath, 'utf8');

        console.log("Ejecutando la migración 014_audit_triggers.sql...");

        // Execute the SQL file directly
        await sql.unsafe(migrationSql);

        console.log("✅ ¡Migración ejecutada exitosamente!");
    } catch (err) {
        console.error("❌ Error al ejecutar la migración:", err.message);
    } finally {
        await sql.end();
    }
}

run();
