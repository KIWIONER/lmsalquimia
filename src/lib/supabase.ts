import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.PUBLIC_SUPABASE_URL ||
  'https://tu-proyecto.supabase.co';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.PUBLIC_SUPABASE_ANON_KEY ||
  'tu-anon-key-aqui';

export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey);
