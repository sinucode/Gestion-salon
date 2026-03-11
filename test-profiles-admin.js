require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
async function run() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase
        .from('profiles')
        .select(`id, first_name, role, location_id, assigned_locations, location:locations!profiles_location_id_fkey(name)`)
        .eq('role', 'admin');
    console.log(JSON.stringify({ data, error }, null, 2));
}
run();
