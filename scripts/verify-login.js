import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function verify() {
    const { data: users, error: uError } = await admin.auth.admin.listUsers();
    if (uError) { console.error('Error fetching users:', uError); return; }
    
    const adminUser = users.users.find(u => u.email === 'admin@wsm.com');
    if (!adminUser) { console.log('Admin user not found!'); return; }
    
    console.log('Admin User Auth Data:', {
        id: adminUser.id,
        email: adminUser.email,
        app_metadata: adminUser.app_metadata
    });

    const { data: profile, error: pError } = await admin.from('profiles').select('*').eq('id', adminUser.id).single();
    if (pError) console.error('Error fetching profile:', pError);
    else console.log('Admin Profile Data:', profile);
    
    // Also try to login using standard client to see the exact error
    const client = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data: session, error: loginError } = await client.auth.signInWithPassword({
        email: 'admin@wsm.com',
        password: 'wilson'
    });
    
    if (loginError) console.error('Login Error:', loginError);
    else console.log('Login Success! Token role:', session.session.user.app_metadata.role);
}
verify();
