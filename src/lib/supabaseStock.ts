import { createClient } from '@supabase/supabase-js';

const stockSupabaseUrl = process.env.NEXT_PUBLIC_STOCK_SUPABASE_URL!;
const stockSupabaseAnonKey = process.env.NEXT_PUBLIC_STOCK_SUPABASE_ANON_KEY!;

export const supabaseStock = createClient(stockSupabaseUrl, stockSupabaseAnonKey);

export default supabaseStock;
