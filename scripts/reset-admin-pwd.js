import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function resetPass() {
    const { data: users, error: uError } = await admin.auth.admin.listUsers();
    const adminUser = users.users.find(u => u.email === 'admin@wsm.com');
    if (!adminUser) return console.log('Admin not found!');
    
    const { error: resetError } = await admin.auth.admin.updateUserById(adminUser.id, {
        password: 'wilsonsinuco',
        email_confirm: true
    });
    
    if (resetError) console.error('Error resetting password:', resetError);
    else console.log('Password successfully reset to "wilsonsinuco" for admin@wsm.com');
}

resetPass();
