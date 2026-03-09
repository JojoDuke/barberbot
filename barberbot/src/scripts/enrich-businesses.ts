import { supabase } from '../lib/supabase.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup basic environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

export async function enrichBusinesses() {
    if (!GOOGLE_PLACES_API_KEY) {
        console.warn('⚠️ GOOGLE_PLACES_API_KEY is not set. Skipping enrichment.');
        return;
    }

    try {
        // 1. Fetch businesses that need enrichment
        const { data: businesses, error } = await supabase
            .from('businesses')
            .select('id, name, address, google_rating')
            .or('address.is.null, google_rating.is.null');

        if (error) {
            console.error('Error fetching businesses for enrichment:', error);
            return;
        }

        if (!businesses || businesses.length === 0) {
            console.log('✨ All businesses are already fully enriched with address and rating.');
            return;
        }

        console.log(`🔍 Found ${businesses.length} businesses needing enrichment. Querying Google Places API...`);

        // 2. Iterate through each and enrich via Google Places
        for (const business of businesses) {
            console.log(`\nEnriching: ${business.name}...`);

            try {
                const query = encodeURIComponent(business.name);
                const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${GOOGLE_PLACES_API_KEY}`;

                const res = await fetch(url);
                const data = await res.json();

                if (data.status === 'OK' && data.results && data.results.length > 0) {
                    const place = data.results[0];

                    const updates: any = {};

                    if (!business.address && place.formatted_address) {
                        updates.address = place.formatted_address;
                        console.log(`   📍 Address found: ${place.formatted_address}`);
                    }

                    if (!business.google_rating && typeof place.rating === 'number') {
                        updates.google_rating = place.rating;
                        console.log(`   ⭐ Rating found: ${place.rating}`);
                    }

                    updates.place_id = place.place_id;

                    // Only update if we actually got new info
                    if (Object.keys(updates).length > 0) {
                        const { error: updateError } = await supabase
                            .from('businesses')
                            .update(updates)
                            .eq('id', business.id);

                        if (updateError) {
                            console.error(`   ❌ Failed to update ${business.name} in DB:`, updateError);
                        } else {
                            console.log(`   ✅ Successfully updated ${business.name} in DB.`);
                        }
                    } else {
                        console.log(`   ℹ️ No new address or rating data found to update for ${business.name}`);
                    }
                } else {
                    console.log(`   ⚠️ Google Places API returned no results or non-OK status for ${business.name}: ${data.status}`);
                }
            } catch (err) {
                console.error(`   ❌ Failed to query Google Places for ${business.name}:`, err);
            }

            // Small artificial delay to avoid hammering the API
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log('\n🎉 Enrichment complete!');
    } catch (error) {
        console.error('Critical failure in enrichBusinesses:', error);
    }
}

// Run it directly if called from CLI
if (process.argv[1]?.includes('enrich-businesses.ts')) {
    enrichBusinesses().then(() => process.exit(0)).catch(() => process.exit(1));
}
