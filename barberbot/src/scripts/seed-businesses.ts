import { supabase } from '../lib/supabase.js';
import { staticBusinesses } from '../config/businesses.js';

async function seedBusinesses() {
    console.log('🌱 Seeding businesses to Supabase...');

    const businessesToInsert = Object.values(staticBusinesses).map(b => ({
        id: b.id,
        name: b.name,
        category: b.category,
        is_default: !!b.isDefault,
        token_env_var: b.tokenEnvVar,
        google_rating: b.googleRating,
        image_url: b.imageUrl,
        website: b.website,
        instagram: b.instagram,
    }));

    const { data, error } = await supabase
        .from('businesses')
        .upsert(businessesToInsert, { onConflict: 'id' });

    if (error) {
        console.error('❌ Error seeding businesses:', error.message);
    } else {
        console.log('✅ Businesses seeded successfully!');
    }
}

seedBusinesses();
