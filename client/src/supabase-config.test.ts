import { describe, expect, it } from 'vitest';
import { validateSupabaseConnection } from './utils/supabase';

describe('Supabase client configuration', () => {
  it('accepts the configured public client credentials', async () => {
    await expect(validateSupabaseConnection()).resolves.toBe(true);
  });
});
