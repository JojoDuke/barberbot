import { supabase } from '../lib/supabase.js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

async function checkAnatomic() {
    const queries = ["Osobní Fyzio Trenér", "Anatomic Fitness Praha", "https://www.osobnifyziotrener.cz/"];
    const out = [];
    for (const q of queries) {
        const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&key=${GOOGLE_PLACES_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.results && data.results.length > 0) {
            out.push({ query: q, found: data.results[0].name, address: data.results[0].formatted_address, rating: data.results[0].rating, id: data.results[0].place_id });
        } else {
            out.push({ query: q, found: false });
        }
    }
    fs.writeFileSync('probe-anatomic.json', JSON.stringify(out, null, 2));
}

checkAnatomic();
