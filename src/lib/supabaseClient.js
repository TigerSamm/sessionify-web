import { createClient } from '@supabase/supabase-js';
import { getSupabaseCredentials } from '../config.js';

let client;

export const getSupabaseClient = () => {
  if (client) return client;
  const { supabaseUrl, supabaseAnonKey } = getSupabaseCredentials();
  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  return client;
};
