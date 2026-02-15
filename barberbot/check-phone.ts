import { supabase } from './src/lib/supabase.js';

async function verify() {
    const { data, error } = await supabase.from('users').select('phone_number').single();
    if (error) console.error(error);
    else console.log('Successfully found phone number:', data.phone_number);
}
verify();
