require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
async function run() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: b } = await supabase.from('businesses').select('id, name');
    const { data: l } = await supabase.from('locations').select('id, name');
    console.log("Businesses", JSON.stringify(b, null, 2));
    console.log("Locations", JSON.stringify(l, null, 2));
}
run();
