import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/^['"]|['"]$/g, '');
const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || '').replace(/^['"]|['"]$/g, '');

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ Supabase credentials not set! Database features will be limited.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
