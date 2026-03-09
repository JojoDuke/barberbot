import { supabase } from '../lib/supabase.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function fixAnatomic() {
    const { data, error: fetchErr } = await supabase
        .from('businesses')
        .select('*')
        .ilike('name', '%anatomic%');

    console.log('Found businesses:', data);

    if (data && data.length > 0) {
        const { error } = await supabase
            .from('businesses')
            .update({
                address: "nám. Hrdinů 886/15, Nusle, 140 00 Praha-Praha 4, Czechia",
                google_rating: 5,
                place_id: "ChIJL6hPVcOVC0cR9zmxZhlGvNc"
            })
            .eq('id', data[0].id);

        if (error) {
            console.error('Failed to update:', error);
        } else {
            console.log('Successfully updated Anatomic Fitness!');
        }
    }
}

fixAnatomic();
