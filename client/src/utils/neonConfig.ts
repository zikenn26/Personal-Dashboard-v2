// Client database config: credentials and connection strings are strictly managed on the server
export const getEffectiveNeonUrl = (): string => '';

// Deprecated Supabase placeholders maintained for API compatibility
export const getEffectiveSupabaseUrl = (): string => '';
export const getEffectiveSupabaseAnonKey = (): string => '';
export const setCustomSupabaseCredentials = (_url: string, _key: string): void => {};
export const hasCustomSupabaseCredentials = (): boolean => false;

export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';
