import { supabase } from '../lib/supabase.js';
import { businesses } from '../config/businesses.js';

async function seedBusinesses() {
    console.log('🌱 Seeding businesses to Supabase...');

    const businessesToInsert = Object.values(businesses).map(b => ({
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
        if (error.code === '42P01') {
            console.log('\n💡 Tip: It looks like the "businesses" table doesn\'t exist yet.');
            console.log('Please run the following SQL in your Supabase SQL Editor first:\n');
            console.log(`
CREATE TABLE businesses (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('barbershop', 'physiotherapy')),
  is_default BOOLEAN DEFAULT FALSE,
  token_env_var TEXT NOT NULL,
  google_rating NUMERIC,
  image_url TEXT,
  website TEXT,
  instagram TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
      `);
        }
    } else {
        console.log('✅ Businesses seeded successfully!');
    }
}

seedBusinesses();
