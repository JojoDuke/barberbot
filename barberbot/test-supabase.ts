import { supabase } from './src/lib/supabase.js';

async function testSupabase() {
    console.log('🔍 Testing Supabase connection...');

    try {
        // Test 1: Try to fetch from 'businesses' (which we seeded earlier)
        console.log('📡 Fetching from "businesses" table...');
        const { data: busData, error: busError } = await supabase.from('businesses').select('id, name').limit(1);

        if (busError) {
            console.error('❌ Error fetching businesses:', busError.message);
        } else {
            console.log('✅ Success! Found businesses:', busData);
        }

        // Test 2: Try to fetch from 'users' (which the user says is there)
        console.log('📡 Fetching from "users" table...');
        const { data: userData, error: userError } = await supabase.from('users').select('*');

        if (userError) {
            console.error('❌ Error fetching users:', userError.message);
        } else if (!userData || userData.length === 0) {
            console.log('⚠️ The "users" table is empty.');
        } else {
            console.log(`✅ Found ${userData.length} users:`);
            userData.forEach((user, index) => {
                console.log(`${index + 1}. Phone: ${user.phone_number || 'N/A'}`);
            });
        }
    } catch (err) {
        console.error('❌ Unexpected error:', err);
    }
}

testSupabase();
