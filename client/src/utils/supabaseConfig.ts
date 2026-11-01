// Built-in Supabase Project Configuration
const DEFAULT_SUPABASE_URL = 'https://amlegmbvqzbhqqqbrvjx.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtbGVnbWJ2cXpiaHFxcWJydmp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyNjM1MTEsImV4cCI6MjEwMzgzOTUxMX0.aEq8TaBGPpsExAJ7Rtl3Qnenl10RPrAuwL9HNMrPvm4';

/**
 * Retrieves the effective Supabase URL.
 * Checks localStorage for custom cloud database instance credentials first,
 * then environment variables, then falls back to default.
 */
export const getEffectiveSupabaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    try {
      const customUrl = localStorage.getItem('lifeos_custom_supabase_url');
      if (customUrl && customUrl.trim().startsWith('http')) {
        return customUrl.trim();
      }
    } catch {}
  }
  return import.meta.env?.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
};

/**
 * Retrieves the effective Supabase Anon Key.
 */
export const getEffectiveSupabaseAnonKey = (): string => {
  if (typeof window !== 'undefined') {
    try {
      const customKey = localStorage.getItem('lifeos_custom_supabase_anon_key');
      if (customKey && customKey.trim().length > 20) {
        return customKey.trim();
      }
    } catch {}
  }
  return import.meta.env?.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
};

/**
 * Saves custom cloud database instance credentials for fresh quota.
 */
export const setCustomSupabaseCredentials = (url: string, key: string): void => {
  if (typeof window === 'undefined') return;
  try {
    if (url && url.trim()) {
      localStorage.setItem('lifeos_custom_supabase_url', url.trim());
    } else {
      localStorage.removeItem('lifeos_custom_supabase_url');
    }

    if (key && key.trim()) {
      localStorage.setItem('lifeos_custom_supabase_anon_key', key.trim());
    } else {
      localStorage.removeItem('lifeos_custom_supabase_anon_key');
    }
  } catch {}
};

/**
 * Checks whether user has provided custom cloud database credentials.
 */
export const hasCustomSupabaseCredentials = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const url = localStorage.getItem('lifeos_custom_supabase_url');
    const key = localStorage.getItem('lifeos_custom_supabase_anon_key');
    return Boolean(url && key && url !== DEFAULT_SUPABASE_URL);
  } catch {
    return false;
  }
};

// Exports for backward compatibility
export const SUPABASE_URL = getEffectiveSupabaseUrl();
export const SUPABASE_ANON_KEY = getEffectiveSupabaseAnonKey();
