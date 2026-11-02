// Supabase has been migrated to Neon Serverless PostgreSQL
export const NEON_DEFAULT_URL =
  'postgresql://neondb_owner:npg_G9a4qZEpMUty@ep-curly-glitter-b4fsklnq-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

export const getEffectiveNeonUrl = (): string => {
  if (typeof window !== 'undefined') {
    try {
      const customUrl = localStorage.getItem('lifeos_custom_neon_url');
      if (customUrl && customUrl.trim().startsWith('postgres')) {
        return customUrl.trim();
      }
    } catch {}
  }
  return NEON_DEFAULT_URL;
};

// Deprecated Supabase placeholders maintained for API compatibility
export const getEffectiveSupabaseUrl = (): string => '';
export const getEffectiveSupabaseAnonKey = (): string => '';
export const setCustomSupabaseCredentials = (_url: string, _key: string): void => {};
export const hasCustomSupabaseCredentials = (): boolean => false;

export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';
