import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const regions = [
    'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
    'eu-west-1', 'eu-west-2', 'eu-central-1',
    'ap-southeast-1', 'ap-southeast-2', 'ap-south-1', 'ap-northeast-1',
    'sa-east-1',
];

const ref = 'nhptxwrwyfbqheznmqba';
const pw = 'GuAWimSg7bvnbqLc';

async function try_region(region) {
    const url = `postgres://postgres.${ref}:${pw}@aws-0-${region}.pooler.supabase.com:5432/postgres`;
    const sql = postgres(url, { ssl: 'require', connect_timeout: 5 });
    try {
        const result = await sql`SELECT 1 as ok`;
        console.log(`✅ Región encontrada: ${region}`);
        await sql.end();
        return region;
    } catch (err) {
        await sql.end({ timeout: 0 }).catch(() => {});
        return null;
    }
}

async function main() {
    console.log("Buscando la región del proyecto Supabase...");
    for (const r of regions) {
        process.stdout.write(`  Probando ${r}... `);
        const found = await try_region(r);
        if (found) {
            console.log(`\nConexión: postgres://postgres.${ref}:***@aws-0-${found}.pooler.supabase.com:5432/postgres`);
            return;
        }
        console.log("❌");
    }
    console.log("No se encontró la región. Verifica la contraseña o el project ref.");
}

main();
