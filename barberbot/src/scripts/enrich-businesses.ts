
import { supabase } from '../lib/supabase.js';
import { getAllBusinesses } from '../config/businesses.js';

export async function enrichBusinesses() {
    console.log('🔍 Checking for businesses to enrich...');
    const businesses = await getAllBusinesses();

    // Only enrich those missing data in Supabase
    const unenriched = businesses.filter(b => !b.address || !b.googleRating || !b.placeId);

    if (unenriched.length === 0) {
        console.log('✅ All businesses already enriched');
        return;
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
        console.warn('⚠️ GOOGLE_PLACES_API_KEY is missing, skipping enrichment');
        return;
    }

    for (const b of unenriched) {
        try {
            // Find place by name + optional website/category for better accuracy
            const queryStr = `${b.name} ${b.category || ''}`.trim();
            const query = encodeURIComponent(queryStr);

            const res = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${apiKey}`);
            const data: any = await res.json();

            if (data.results && data.results.length > 0) {
                const place = data.results[0];
                const updates = {
                    address: b.address || place.formatted_address,
                    google_rating: b.googleRating || place.rating,
                    place_id: b.placeId || place.place_id,
                };

                const { error } = await supabase
                    .from('businesses')
                    .update(updates)
                    .eq('id', b.id);

                if (error) {
                    console.error(`❌ Error updating ${b.name} in Supabase:`, error.message);
                } else {
                    console.log(`✅ Successfully enriched ${b.name}: ${updates.address} (Rating: ${updates.google_rating})`);
                }
            } else {
                console.warn(`❓ No Google Places results found for query: "${queryStr}"`);
            }
        } catch (err) {
            console.error(`❌ Failed to fetch Google Places data for ${b.name}:`, err);
        }
    }
}
