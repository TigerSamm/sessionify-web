const DEFAULT_SUPABASE_URL = 'https://lbkkgwmdauelpkkpruhp.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxia2tnd21kYXVlbHBra3BydWhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE1MzIyODcsImV4cCI6MjA0NzEwODI4N30.kCLIHf1kvqbwVDvU6SmDRApVQS5sb9vdGzTAOHFVC3Q';

const getRuntimeConfig = () => {
  if (typeof window !== 'undefined') {
    const runtime = window.SESSIONIFY_AUTH_CONFIG || window.SESSIONIFY_HELP_CONFIG || {};
    return {
      supabaseUrl: runtime.supabaseUrl || import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL,
      supabaseAnonKey: runtime.supabaseAnonKey || import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY,
      googleEdgeFunction: runtime.googleEdgeFunction || import.meta.env.VITE_GOOGLE_EDGE_FUNCTION || `${runtime.supabaseUrl || import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL}/functions/v1/google-oauth`,
    };
  }
  return {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL,
    supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY,
    googleEdgeFunction: import.meta.env.VITE_GOOGLE_EDGE_FUNCTION || `${import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL}/functions/v1/google-oauth`,
  };
};

export const getSupabaseCredentials = () => {
  const { supabaseUrl, supabaseAnonKey } = getRuntimeConfig();
  return { supabaseUrl, supabaseAnonKey };
};

export const getGoogleEdgeFunctionUrl = () => getRuntimeConfig().googleEdgeFunction;

export const SESSIONIFY_PROTOCOL = (typeof window !== 'undefined' && window.SESSIONIFY_PROTOCOL) || 'sessionify';
export const AUTH_SESSION_STORAGE_KEY = 'sessionifyAuthSession';
export const ACCOUNT_PORTAL_URL = '/app';
